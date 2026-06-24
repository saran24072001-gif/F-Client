import axiosInstance from './axiosInstance';

export const login = (data) => {
  return axiosInstance.post('/auth/login', data, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const signup = (data) => {
  return axiosInstance.post('/auth/signup', data, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const forgotPassword = (email) => {
  return axiosInstance.post('/auth/forgot-password', { email }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
