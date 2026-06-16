const createCRUDController = require('@/controllers/middlewaresControllers/createCRUDController');
const methods = createCRUDController('Payment');

const create = require('./create');
const summary = require('./summary');
const update = require('./update');
const remove = require('./remove');
const sendMail = require('./sendMail');

const paginatedList = require('./paginatedList');

const read = require('./read');
const downloadPdf = require('@/handlers/downloadHandler/downloadPdf');

methods.download = (req, res) => {
  return downloadPdf(req, res, { directory: 'payment', id: req.params.id });
};

methods.mail = sendMail;
methods.create = create;
methods.update = update;
methods.delete = remove;
methods.summary = summary;
methods.list = paginatedList;
methods.read = read;

module.exports = methods;
