import axiosInstance from './axiosInstance';

export const getDashboardChanges = () => {
  return axiosInstance.get('/dashboard/changes');
};

export const getDashboardCounts = () => {
  return axiosInstance.get('/dashboard/counts');
};
