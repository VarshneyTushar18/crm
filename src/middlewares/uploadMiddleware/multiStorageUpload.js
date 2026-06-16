const multer = require('multer');
const path = require('path');
const { slugify } = require('transliteration');
const fileFilter = require('./utils/LocalfileFilter');

const multiStorageUpload = ({
  entity,
  fileType = 'default',
  fields = [],
}) => {
  var diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, `src/public/uploads/${entity}`);
    },
    filename: function (req, file, cb) {
      try {
        let fileExtension = path.extname(file.originalname);
        const filePath = `public/uploads/${entity}/${_fileName}`;
        
        if (!req.upload) req.upload = {};
        if (!req.upload.files) req.upload.files = [];

        req.upload.files.push({
          fileName: _fileName,
          fieldExt: fileExtension,
          entity: entity,
          fieldName: file.fieldname,
          fileType: fileType,
          filePath: filePath,
        });

        if (!req.body[file.fieldname]) {
          req.body[file.fieldname] = [];
        }
        req.body[file.fieldname].push(filePath);

        cb(null, _fileName);
      } catch (error) {
        cb(error);
      }
    },
  });

  let filterType = fileFilter(fileType);

  return multer({ storage: diskStorage, fileFilter: filterType }).fields(fields);
};

module.exports = multiStorageUpload;
