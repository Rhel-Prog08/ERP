'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../utils/response');
const service = require('./service');

module.exports = {
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, await service.list(req.user, req.query));
  }),

  get: asyncHandler(async (req, res) => {
    sendSuccess(res, await service.get(req.user, req.params.id));
  }),

  create: asyncHandler(async (req, res) => {
    sendCreated(res, await service.create(req.user, req.body, req));
  }),

  confirm: asyncHandler(async (req, res) => {
    sendSuccess(res, await service.confirm(req.user, req.params.id, req));
  }),

  complete: asyncHandler(async (req, res) => {
    sendSuccess(res, await service.complete(req.user, req.params.id, req));
  }),

  cancel: asyncHandler(async (req, res) => {
    sendSuccess(res, await service.cancel(req.user, req.params.id, req.body.cancelReason, req));
  }),
};
