import axiosInstance from './axiosInstance';

export const getProcesses = () => {
  return axiosInstance.get('/processes');
};

export const addProcess = (name) => {
  return axiosInstance.post('/processes', { name }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const deleteProcess = (name) => {
  return axiosInstance.delete(`/processes/${encodeURIComponent(name)}`);
};
