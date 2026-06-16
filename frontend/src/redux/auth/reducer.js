import * as actionTypes from "./types";

const INITIAL_STATE = {
  current: null,          // ✅ keep null initially
  token: null,            // ✅ add token support for modules/API
  isLoggedIn: false,
  isLoading: false,
  isSuccess: false,
};

const normalizeAuthPayload = (payload) => {
  // supports:
  // payload = { token, user/current }
  // payload = { result: { token, user } }
  // payload = userObject (old idurar style)
  const token =
    payload?.token ||
    payload?.result?.token ||
    payload?.jwt ||
    null;

  const current =
    payload?.current ||
    payload?.user ||
    payload?.result?.user ||
    payload ||
    null;

  return { token, current };
};

const authReducer = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case actionTypes.REQUEST_LOADING:
      return {
        ...state,
        isLoading: true,
      };

    case actionTypes.REQUEST_FAILED:
      return {
        ...INITIAL_STATE,
      };

    // ✅ This is Idurar's main "login success" in many modules
    case actionTypes.REQUEST_SUCCESS: {
      const { token, current } = normalizeAuthPayload(action.payload);

      return {
        ...state,
        current,
        token,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
    }

    case actionTypes.REGISTER_SUCCESS:
      return {
        ...state,
        current: null,
        token: null,
        isLoggedIn: false,
        isLoading: false,
        isSuccess: true,
      };

    case actionTypes.LOGOUT_SUCCESS:
      return {
        ...INITIAL_STATE,
      };

    case actionTypes.LOGOUT_FAILED:
      return {
        ...state,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };

    // ✅ fallback (your custom dispatch types)
    case "AUTH_SUCCESS":
    case "LOGIN_SUCCESS":
    case "AUTH_LOGIN_SUCCESS": {
      const { token, current } = normalizeAuthPayload(action.payload);

      return {
        ...state,
        current,
        token,
        isLoggedIn: true,
        isLoading: false,
        isSuccess: true,
      };
    }

    default:
      return state;
  }
};

export default authReducer;