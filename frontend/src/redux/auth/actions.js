/*import * as actionTypes from './types';
import * as authService from '@/auth';
import { request } from '@/request';

export const login =
  ({ loginData }) =>
  async (dispatch) => {
    dispatch({
      type: actionTypes.REQUEST_LOADING,
    });
    const data = await authService.login({ loginData });

    if (data.success === true) {
      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({
        type: actionTypes.REQUEST_FAILED,
      });
    }
  };

export const register =
  ({ registerData }) =>
  async (dispatch) => {
    dispatch({
      type: actionTypes.REQUEST_LOADING,
    });
    const data = await authService.register({ registerData });

    if (data.success === true) {
      dispatch({
        type: actionTypes.REGISTER_SUCCESS,
      });
    } else {
      dispatch({
        type: actionTypes.REQUEST_FAILED,
      });
    }
  };

export const verify =
  ({ userId, emailToken }) =>
  async (dispatch) => {
    dispatch({
      type: actionTypes.REQUEST_LOADING,
    });
    const data = await authService.verify({ userId, emailToken });

    if (data.success === true) {
      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({
        type: actionTypes.REQUEST_FAILED,
      });
    }
  };

export const resetPassword =
  ({ resetPasswordData }) =>
  async (dispatch) => {
    dispatch({
      type: actionTypes.REQUEST_LOADING,
    });
    const data = await authService.resetPassword({ resetPasswordData });

    if (data.success === true) {
      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({
        type: actionTypes.REQUEST_FAILED,
      });
    }
  };

export const logout = () => async (dispatch) => {
  dispatch({
    type: actionTypes.LOGOUT_SUCCESS,
  });
  const result = window.localStorage.getItem('auth');
  const tmpAuth = JSON.parse(result);
  const settings = window.localStorage.getItem('settings');
  const tmpSettings = JSON.parse(settings);
  window.localStorage.removeItem('auth');
  window.localStorage.removeItem('settings');
  window.localStorage.setItem('isLogout', JSON.stringify({ isLogout: true }));
  const data = await authService.logout();
  if (data.success === false) {
    const auth_state = {
      current: tmpAuth,
      isLoggedIn: true,
      isLoading: false,
      isSuccess: true,
    };
    window.localStorage.setItem('auth', JSON.stringify(auth_state));
    window.localStorage.setItem('settings', JSON.stringify(tmpSettings));
    window.localStorage.removeItem('isLogout');
    dispatch({
      type: actionTypes.LOGOUT_FAILED,
      payload: data.result,
    });
  } else {
    // on lgout success
  }
};

export const updateProfile =
  ({ entity, jsonData }) =>
  async (dispatch) => {
    let data = await request.updateAndUpload({ entity, id: '', jsonData });

    if (data.success === true) {
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
    }
  };

*/

import * as actionTypes from './types';
import * as authService from '@/auth';
import { request } from '@/request';

export const login =
  ({ loginData }) =>
  async (dispatch) => {
    dispatch({ type: actionTypes.REQUEST_LOADING });

    const data = await authService.login({ loginData });

    if (data?.success === true) {
      // ✅ Extract token from possible locations
      const token =
        data?.token ||
        data?.result?.token ||
        data?.result?.jwt ||
        data?.result?.accessToken ||
        data?.result?.refreshToken; // (if your backend uses it)

      // ✅ Store token separately for API calls
      if (token) {
        window.localStorage.setItem('token', token);
      }

      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };

      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');

      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({ type: actionTypes.REQUEST_FAILED });
    }
  };

export const register =
  ({ registerData }) =>
  async (dispatch) => {
    dispatch({ type: actionTypes.REQUEST_LOADING });

    const data = await authService.register({ registerData });

    if (data?.success === true) {
      dispatch({ type: actionTypes.REGISTER_SUCCESS });
    } else {
      dispatch({ type: actionTypes.REQUEST_FAILED });
    }
  };

export const verify =
  ({ userId, emailToken }) =>
  async (dispatch) => {
    dispatch({ type: actionTypes.REQUEST_LOADING });

    const data = await authService.verify({ userId, emailToken });

    if (data?.success === true) {
      const token =
        data?.token ||
        data?.result?.token ||
        data?.result?.jwt ||
        data?.result?.accessToken;

      if (token) {
        window.localStorage.setItem('token', token);
      }

      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };

      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');

      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({ type: actionTypes.REQUEST_FAILED });
    }
  };

export const resetPassword =
  ({ resetPasswordData }) =>
  async (dispatch) => {
    dispatch({ type: actionTypes.REQUEST_LOADING });

    const data = await authService.resetPassword({ resetPasswordData });

    if (data?.success === true) {
      const token =
        data?.token ||
        data?.result?.token ||
        data?.result?.jwt ||
        data?.result?.accessToken;

      if (token) {
        window.localStorage.setItem('token', token);
      }

      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };

      window.localStorage.setItem('auth', JSON.stringify(auth_state));
      window.localStorage.removeItem('isLogout');

      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });
    } else {
      dispatch({ type: actionTypes.REQUEST_FAILED });
    }
  };

export const logout = () => async (dispatch) => {
  dispatch({ type: actionTypes.LOGOUT_SUCCESS });

  const result = window.localStorage.getItem('auth');
  const tmpAuth = result ? JSON.parse(result) : null;

  const settings = window.localStorage.getItem('settings');
  const tmpSettings = settings ? JSON.parse(settings) : null;

  window.localStorage.removeItem('auth');
  window.localStorage.removeItem('settings');
  window.localStorage.removeItem('token'); // ✅ remove token on logout
  window.localStorage.setItem('isLogout', JSON.stringify({ isLogout: true }));

  const data = await authService.logout();

  if (data?.success === false) {
    // rollback if logout failed
    if (tmpAuth) {
      const auth_state = {
        current: tmpAuth,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
      window.localStorage.setItem('auth', JSON.stringify(auth_state));
    }
    if (tmpSettings) {
      window.localStorage.setItem('settings', JSON.stringify(tmpSettings));
    }
    window.localStorage.removeItem('isLogout');

    dispatch({
      type: actionTypes.LOGOUT_FAILED,
      payload: data.result,
    });
  } else {
    // logout success - nothing
  }
};

export const updateProfile =
  ({ entity, jsonData }) =>
  async (dispatch) => {
    let data = await request.updateAndUpload({ entity, id: '', jsonData });

    if (data?.success === true) {
      dispatch({
        type: actionTypes.REQUEST_SUCCESS,
        payload: data.result,
      });

      const auth_state = {
        current: data.result,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };

      window.localStorage.setItem('auth', JSON.stringify(auth_state));
    }
  };
