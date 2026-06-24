import axiosInstance from './axiosInstance';

export const getMachines = () => {
  return axiosInstance.get('/machines');
};

export const addMachine = (name) => {
  return axiosInstance.post('/machines', { name }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const deleteMachine = (name) => {
  return axiosInstance.delete(`/machines/${encodeURIComponent(name)}`);
};
