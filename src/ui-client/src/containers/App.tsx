/* Copyright (c) 2022, UW Medicine Research IT, University of Washington
 * Developed by Nic Dobbins and Cliff Spital, CRIO Sean Mooney
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */ 

import React from 'react';

import { connect } from 'react-redux';
import { getIdToken, receiveIdToken } from '../actions/auth';
import { refreshSession, saveSessionAndLogout, refreshServerStateLoop } from '../actions/session';
import { RouteConfig } from '../config/routes';
import Attestation from '../containers/Attestation/Attestation';
import CohortCountBox from '../containers/CohortCountBox/CohortCountBox';
import Header from '../containers/Header/Header';
import { AppState, AuthorizationState } from '../models/state/AppState';
import ExportState from '../models/state/Export';
import { Routes, ConfirmationModalState, InformationModalState, NoClickModalState, Browser, BrowserType, SideNotificationState, UserInquiryState } from '../models/state/GeneralUiState';
import { SessionState } from '../models/Session';
import MyLeafModal from './MyLeafModal/MyLeafModal';
import SaveQueryPanel from './SaveQueryPanel/SaveQueryPanel';
import Sidebar from './Sidebar/Sidebar';
import InformationModal from '../components/Modals/InformationModal/InformationModal';
import ConfirmationModal from '../components/Modals/ConfirmationModal/ConfirmationModal';
import NoClickModal from '../components/Modals/NoClickModal/NoClickModal';
import { setRouteConfig, showInfoModal } from '../actions/generalUi';
import HelpButton from '../components/HelpButton/HelpButton';
import { PatientCountState } from '../models/state/CohortState';
import { AdminPanelPane } from '../models/state/AdminState';
import SideNotification from '../components/SideNotification/SideNotification';
import DataImportContainer from '../containers/DataImport/DataImport';
import UserQuestionModal from './UserQuestionModal/UserQuestionModal';
import { SavedQueryMap } from '../models/Query';
import { sleep } from '../utils/Sleep';
import NotificationModal from '../components/Modals/NotificationModal/NotificationModal';
import MaintainenceModal from '../components/Modals/MaintainenceModal/MaintainenceModal';
import './App.css';
import { getUserDetails } from '../services/centuryHealthAPI';
import { AuthorityMap } from '../utils/constants';

interface OwnProps {
}
interface DispatchProps {
    dispatch: any;
}
interface StateProps {
    auth?: AuthorizationState;
    browser?: Browser;
    cohortCountState: PatientCountState;
    confirmationModal: ConfirmationModalState;
    currentAdminPane: AdminPanelPane;
    currentRoute: Routes;
    exportState: ExportState;
    informationModal: InformationModalState;
    noclickModal: NoClickModalState;
    queries: SavedQueryMap;
    routes: RouteConfig[];
    session: SessionState;
    sideNotification: SideNotificationState;
    userQuestion: UserInquiryState;
}

interface state {
    currentUser: "loading" | null | any;
}

type Props = StateProps & DispatchProps & OwnProps;
let inactivityTimer: NodeJS.Timer;


class App extends React.Component<Props, state> {
    private sessionTokenRefreshMinutes = 4;
    private serverStateCheckIntervalMinutes = 1;
    private heartbeatCheckIntervalSeconds = 10;
    private lastHeartbeat = new Date();

    constructor(props: Props) {
        super(props);
        this.state = {
            currentUser: "loading"
        };
    }

    public componentDidMount() {
        const { dispatch } = this.props;
        this.handleBrowserHeartbeat();
        this.handleSessionTokenRefresh();
        dispatch(getIdToken());
        dispatch(refreshServerStateLoop());

        // Replace Firebase auth with direct API call
        this.fetchUserDetails();
    }

    private async fetchUserDetails() {
        try {
            const response = await getUserDetails();
            this.setState({ currentUser: response });
            if(response.role === AuthorityMap.RESEARCHER) {
                this.props.dispatch(receiveIdToken({
                    ...this.props.auth.userContext,
                    isAdmin: false,
                    isSuperUser: false,
                    isPhiOkay: false,
                    isFederatedOkay: false,
                    chPlanDetails: response.plans,
                    chUserDetails: {
                        firstName: response.firstName,
                        lastName: response.lastName,
                        email: response.email,
                    }
                }));
                // If the user is a researcher, we need to remove the admin routes
                this.props.dispatch(setRouteConfig(
                    this.props.routes.filter((route) => route.index !== Routes.AdminPanel)
                ));
            } else if(response.role === AuthorityMap.ADMIN) {
                this.props.dispatch(receiveIdToken({
                    ...this.props.auth.userContext,
                    isAdmin: true,
                    isSuperUser: false,
                    isPhiOkay: false,
                    isFederatedOkay: false,
                    chPlanDetails: response.plans,
                    chUserDetails: {
                        firstName: response.firstName,
                        lastName: response.lastName,
                        email: response.email,
                    }
                }));
            }
        } catch (error) {
            console.error('Error fetching user details:', error);
            this.setState({ currentUser: null });
        }
    }

    private handleCHLogin = () => {
        document.cookie = `setAT=; path=/; domain=century.health; secure; SameSite=Strict`;
        document.cookie = `setAT=${true}; path=/; domain=century.health; secure; SameSite=Strict`;
        window.open('https://staging.century.health/', '_blank');
    }

    public componentDidUpdate() { 
        return; 
    }

    public render() {
        const { 
            auth, browser, cohortCountState, currentRoute, currentAdminPane, confirmationModal, queries,
            informationModal, dispatch, noclickModal, routes, sideNotification, session, userQuestion
        } = this.props;
        const content = routes.length 
            ? routes.find((r: RouteConfig) => r.index === currentRoute)!.render()
            : null;
        const classes = [ 'app-container' ];

        /* 
         * Add the browser name as an app-level CSS class.
         */
        if (browser) { classes.push(BrowserType[browser.type].toLowerCase())};

        return (
            this.state.currentUser === "loading" 
            ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
            : this.state.currentUser === null ?
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                Please Login to 
                <span>
                    <span
                        onClick={this.handleCHLogin}
                        style={{ color: 'blue', marginLeft: '5px', marginRight: '5px', cursor: 'pointer' }}
                    >
                        Century Health
                    </span>
                </span>
                and refresh the page to continue.
            </div>
            : <div className={classes.join(' ')} onMouseDown={this.handleActivity} onKeyDown={this.handleActivity}>
                <Attestation />
                <CohortCountBox />
                <Header chUser={this.state.currentUser} />
                <Sidebar currentRoute={currentRoute} dispatch={dispatch} routes={routes} cohortCountState={cohortCountState} currentAdminPane={currentAdminPane} />
                {/* <HelpButton auth={auth} dispatch={dispatch} /> */}
                <UserQuestionModal dispatch={dispatch} state={userQuestion} queries={queries} />
                <SideNotification dispatch={dispatch} state={sideNotification} />
                {session.context &&
                <div id="main-content">
                    <SaveQueryPanel />
                    <MyLeafModal />
                    <DataImportContainer />
                    {content}
                </div>
                }
                <InformationModal informationModal={informationModal} dispatch={dispatch} />
                <ConfirmationModal confirmationModal={confirmationModal} dispatch={dispatch} />
                <NoClickModal state={noclickModal} dispatch={dispatch} />
                {auth.serverState && 
                <NotificationModal dispatch={dispatch} />
                }
                {session.context && !auth.serverState.isUp && session.hasAttested && auth.userContext.isAdmin &&
                <MaintainenceModal />
                }
            </div>
        );
    }

    /*
     * Poll at short intervals to test that browser is active.
     * If the gap between 2 heartbeats is greater than twice
     * the polling interval, the browser was likely asleep, so
     * try to refresh the session.
     */
    private handleBrowserHeartbeat = () => {
        const { dispatch } = this.props;
        const now = new Date();
        const diffSeconds = (now.getTime() - this.lastHeartbeat.getTime()) / 1000;

        if (diffSeconds > (this.heartbeatCheckIntervalSeconds * 2)) {
            dispatch(refreshSession());
        }
        setTimeout(this.handleBrowserHeartbeat, this.heartbeatCheckIntervalSeconds * 1000);
        this.lastHeartbeat = now;
    }

    /*
     * Refresh user session token every 4 minutes.
     */
    private async handleSessionTokenRefresh() {
        const { dispatch, session } = this.props;

        if (session.context) {
            await sleep(this.sessionTokenRefreshMinutes * 60000);
            dispatch(refreshSession());
            this.handleSessionTokenRefresh();
        } else {
            await sleep(10000);
            this.handleSessionTokenRefresh();
        }
    }

    /*
     * Handle user activity via mouse or key action, which resets the inactivity timeout.
     */
    private handleActivity = () => {
        const { dispatch, auth, session, exportState } = this.props;
        if (!session.context || auth!.config!.authentication.inactivityTimeoutMinutes <= 0) { return; }

        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }
        inactivityTimer = setTimeout(() => {

            /* Bail if user is exporting */
            if (exportState.isExporting) {
                return;
            }
            
            dispatch(showInfoModal({ 
                header: 'Session Inactive', 
                body: `You've been logged out due to inactivity. Please log back in to resume your session.`, 
                show: true, 
                onClickOkay: () => dispatch(saveSessionAndLogout())
            }));
        }, auth!.config!.authentication.inactivityTimeoutMinutes * 1000 * 60);
    }
}

const mapStateToProps = (state: AppState) => {
    return {
        auth: state.auth,
        browser: state.generalUi.browser,
        cohortCountState: state.cohort.count,
        confirmationModal: state.generalUi.confirmationModal,
        currentAdminPane: state.admin ? state.admin!.activePane : 0, 
        currentRoute: state.generalUi.currentRoute,
        exportState: state.dataExport,
        informationModal: state.generalUi.informationModal,
        noclickModal: state.generalUi.noclickModal,
        queries: state.queries.saved,
        routes: state.generalUi.routes,
        session: state.session,
        sideNotification: state.generalUi.sideNotification,
        userQuestion: state.generalUi.userQuestion,
        user: state.auth.userContext
    };
};

const mapDispatchToProps = (dispatch: any) => {
    return {
        dispatch
    };
};

export default connect<StateProps, DispatchProps, OwnProps, AppState>
    (mapStateToProps, mapDispatchToProps)(App);
