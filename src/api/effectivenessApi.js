import axiosInstance from './axiosInstance';

export const getEffectivenessLogs = (tab) => {
  return axiosInstance.get('/effectiveness', { params: { tab } });
};

export const getEffectivenessCounts = () => {
  return axiosInstance.get('/effectiveness/counts');
};

export const createEffectivenessLog = (logData, attachments) => {
  return axiosInstance.post('/effectiveness', { logData, attachments }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const updateEffectivenessLog = (id, logData, attachments) => {
  return axiosInstance.put(`/effectiveness/${id}`, { logData, attachments }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const deleteEffectivenessLog = (id) => {
  return axiosInstance.delete(`/effectiveness/${id}`);
};

export const getEffectivenessAttachment = (logId, fileName) => {
  return axiosInstance.get(`/effectiveness/attachment/${logId}/${fileName}`, {
    responseType: 'blob'
  });
};

export const resetEffectivenessLogs = () => {
  return axiosInstance.post('/effectiveness/reset');
};
