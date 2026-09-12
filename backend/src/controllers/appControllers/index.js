const createCRUDController = require('../middlewaresControllers/createCRUDController');
const { routesList } = require('../../models/utils');

// Static imports ensure Vercel Node File Trace (NFT) bundles all controller files
const customControllerMap = {
  clientController: require('./clientController'),
  invoiceController: require('./invoiceController'),
  paymentController: require('./paymentController'),
  paymentModeController: require('./paymentModeController'),
  quoteController: require('./quoteController'),
  taxesController: require('./taxesController'),
};

const appControllers = () => {
  const controllers = {};
  const hasCustomControllers = [];

  Object.entries(customControllerMap).forEach(([controllerName, customController]) => {
    if (customController) {
      hasCustomControllers.push(controllerName);
      controllers[controllerName] = customController;
    }
  });

  routesList.forEach(({ modelName, controllerName }) => {
    if (!hasCustomControllers.includes(controllerName)) {
      controllers[controllerName] = createCRUDController(modelName);
    }
  });

  return controllers;
};

module.exports = appControllers();
