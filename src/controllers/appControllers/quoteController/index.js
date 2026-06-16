const createCRUDController = require('@/controllers/middlewaresControllers/createCRUDController');
const methods = createCRUDController('Quote');

const sendMail = require('./sendMail');
const create = require('./create');
const summary = require('./summary');
const update = require('./update');
const convertQuoteToInvoice = require('./convertQuoteToInvoice');
const paginatedList = require('./paginatedList');
const read = require('./read');
const downloadPdf = require('@/handlers/downloadHandler/downloadPdf');

methods.download = (req, res) => {
  return downloadPdf(req, res, { directory: 'quote', id: req.params.id });
};

methods.list = paginatedList;
methods.read = read;

methods.mail = sendMail;
methods.create = create;
methods.update = update;
methods.convert = convertQuoteToInvoice;
methods.summary = summary;

module.exports = methods;
