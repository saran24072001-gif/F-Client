import axiosInstance from './axiosInstance';

export const getServerTime = () => {
  return axiosInstance.get('/time');
};
