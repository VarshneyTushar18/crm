const createCRUDController = require('../../middlewaresControllers/createCRUDController');
const methods = createCRUDController('Invoice');

const sendMail = require('./sendMail');
const create = require('./create');
const summary = require('./summary');
const update = require('./update');
const remove = require('./remove');
const paginatedList = require('./paginatedList');
const read = require('./read');
const issue = require('./issue');
const verifyPayment = require('./verifyPayment');
const downloadPdf = require('@/handlers/downloadHandler/downloadPdf');

methods.download = (req, res) => {
  return downloadPdf(req, res, { directory: 'invoice', id: req.params.id });
};

methods.mail = sendMail;
methods.create = create;
methods.update = update;
methods.delete = remove;
methods.summary = summary;
methods.list = paginatedList;
methods.read = read;
methods.issue = issue;
methods.verifyPayment = verifyPayment;

module.exports = methods;
