import axiosInstance from './axiosInstance';

export const getDepartments = () => {
  return axiosInstance.get('/departments');
};

export const addDepartment = (name) => {
  return axiosInstance.post('/departments', { name }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const deleteDepartment = (name) => {
  return axiosInstance.delete(`/departments/${encodeURIComponent(name)}`);
};
