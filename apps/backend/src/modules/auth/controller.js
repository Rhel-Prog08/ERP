'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const service = require('./service');

module.exports = {
  login: asyncHandler(async (req, res) => {
    const data = await service.login(req.body, req);
    sendSuccess(res, data);
  }),

  refresh: asyncHandler(async (req, res) => {
    const data = await service.refresh(req.body, req);
    sendSuccess(res, data);
  }),

  logout: asyncHandler(async (req, res) => {
    const data = await service.logout(req.body, req);
    sendSuccess(res, data);
  }),

  changePassword: asyncHandler(async (req, res) => {
    const data = await service.changePassword(
      { actor: req.user, ...req.body },
      req
    );
    sendSuccess(res, data);
  }),

  me: asyncHandler(async (req, res) => {
    const data = await service.getMe(req.user);
    sendSuccess(res, data);
  }),
};
