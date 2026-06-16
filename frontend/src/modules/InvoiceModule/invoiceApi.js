import { request } from '@/request';

// Invoice API functions
export const invoiceApi = {
  // Create invoice
  create: async (data) => {
    return request.create({ entity: 'invoice', jsonData: data });
  },

  // Read invoice
  read: async (id) => {
    return request.read({ entity: 'invoice', id });
  },

  // Update invoice
  update: async (id, data) => {
    return request.update({ entity: 'invoice', id, jsonData: data });
  },

  // Delete invoice
  delete: async (id) => {
    return request.delete({ entity: 'invoice', id });
  },

  // List invoices
  list: async (options = {}) => {
    return request.list({ entity: 'invoice', options });
  },

  // Issue invoice
  issue: async (id) => {
    return request.patch({
      entity: `invoice/issue/${id}`,
      jsonData: {},
    });
  },

  // Get financial summary
  summary: async () => {
    return request.get({ entity: 'invoice/summary' });
  },

  // Search jobs for invoice creation
  searchJobs: async (searchText) => {
    return request.list({
      entity: 'job',
      options: {
        filter: searchText ? `jobId~${searchText}` : '',
        fields: 'jobId,customer,lockedValue,systemState'
      }
    });
  },

  // Payment functions
  createPayment: async (data) => {
    return request.create({ entity: 'payment', jsonData: data });
  },

  listPayments: async (options = {}) => {
    return request.list({ entity: 'payment', options });
  },

  // Get payment modes
  getPaymentModes: async () => {
    return request.get({ entity: 'paymentmode/list' });
  },

  // Verify customer payment notification
  verifyPayment: async (id, data) => {
    return request.patch({
      entity: `invoice/verify-payment/${id}`,
      jsonData: data,
    });
  },
};

export default invoiceApi;