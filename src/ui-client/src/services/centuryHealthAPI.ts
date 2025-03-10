// This file is used to make API calls to the Century Health API

import axios from 'axios';

const API_URL = process.env.REACT_APP_STAGING_URL;

export const getUserDetails = async () => {
    const response = await axios.get(`${API_URL}/users/get-logged-in-user-details`, {
        headers: {
            'Authorization': `Bearer ${document.cookie.split('accessToken=')[1].split(';')[0]}`
        }
    });
    return response.data;
};