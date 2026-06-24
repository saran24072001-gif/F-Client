import axiosInstance from './axiosInstance';

export const getRoles = () => {
  return axiosInstance.get('/roles');
};

export const addRole = (name) => {
  return axiosInstance.post('/roles', { name }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const deleteRole = (name) => {
  return axiosInstance.delete(`/roles/${encodeURIComponent(name)}`);
};
