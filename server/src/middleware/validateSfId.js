/**
 * Express middleware to validate Salesforce IDs in route params.
 * Usage: router.get('/:id', validateSfIdParam('id'), handler)
 * @param {string} paramName - The route param name to validate (default: 'id')
 */
function validateSfIdParam(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(value)) {
      return res.status(400).json({ error: `Invalid Salesforce ID for parameter "${paramName}"` });
    }
    next();
  };
}

module.exports = validateSfIdParam;
