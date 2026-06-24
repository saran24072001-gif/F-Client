import axiosInstance from './axiosInstance';

export const getNotifications = () => {
  return axiosInstance.get('/notifications');
};

export const toggleNotificationRead = (id) => {
  return axiosInstance.put(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = () => {
  return axiosInstance.put('/notifications/mark-all-read');
};

export const clearReadNotifications = () => {
  return axiosInstance.put('/notifications/clear-read');
};

export const deleteNotification = (id) => {
  return axiosInstance.delete(`/notifications/${id}`);
};

export const resetNotifications = () => {
  return axiosInstance.post('/notifications/reset');
};
