import axiosInstance from './axiosInstance';

export const getChanges = () => {
  return axiosInstance.get('/changes');
};

export const updateChangeStatus = (id, status) => {
  return axiosInstance.put(`/changes/${id}/status`, { status }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const updateChangeDetails = (id, level, updateData, attachments) => {
  return axiosInstance.put(`/changes/${id}/details?level=${level}`, { updateData, attachments }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const createL1Request = (l1Data, attachments) => {
  return axiosInstance.post('/changes/l1', { l1Data, attachments }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const getL1Attachment = (changeNo, fileName) => {
  return axiosInstance.get(`/changes/l1/attachment/${changeNo}/${fileName}`, {
    responseType: 'blob'
  });
};

export const getL2ValidationLogs = () => {
  return axiosInstance.get('/changes/l2');
};

export const createL2ValidationLog = (logData, attachments) => {
  return axiosInstance.post('/changes/l2', { logData, attachments }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const getL2Attachment = (changeNo, fileName) => {
  return axiosInstance.get(`/changes/l2/attachment/${changeNo}/${fileName}`, {
    responseType: 'blob'
  });
};

export const getL3Approvals = () => {
  return axiosInstance.get('/changes/l3');
};

export const getL3Details = (changeNo) => {
  return axiosInstance.get(`/changes/l3/${encodeURIComponent(changeNo)}`);
};

export const createL3Approval = (logData) => {
  return axiosInstance.post('/changes/l3', { logData }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const getNextChangeNo = () => {
  return axiosInstance.get('/changes/next-no');
};

export const getL1Details = (changeNo) => {
  return axiosInstance.get(`/changes/l1/${changeNo}`);
};

export const getL2Details = (changeNo) => {
  return axiosInstance.get(`/changes/l2/${changeNo}`);
};


