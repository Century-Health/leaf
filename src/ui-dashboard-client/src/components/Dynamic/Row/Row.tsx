import React from 'react';
import { Row } from 'reactstrap';
import { ContentRowConfig } from '../../../models/config/content';
import { PatientData } from '../../../models/state/CohortState';
import { renderDynamic } from '../../../utils/dynamicRender';
import './Row.css';

interface Props {
    config: ContentRowConfig;
    patient: PatientData;
}

export default class DynamicRow extends React.Component<Props> {
    private className = 'dynamic-row';

    public render() {
        const { config, patient } = this.props;
        const c = this.className;

        return (
            <Row className={`${c}-container`}>
                {config.content.map(innerContent => renderDynamic(innerContent, patient))}
            </Row>
        );
    }
};