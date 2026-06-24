import axiosInstance from './axiosInstance';

export const getUsers = () => {
  return axiosInstance.get('/users');
};

export const deleteUser = (id) => {
  return axiosInstance.delete(`/users/${id}`);
};

export const updateUser = (id, data) => {
  return axiosInstance.put(`/users/${id}`, data, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
