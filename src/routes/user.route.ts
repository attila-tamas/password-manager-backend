import { Router } from "express";

import errorHandler from "@middlewares/errorHandler.middleware";
import { requestEmailLimiter } from "@middlewares/rateLimiters.middleware";
import {
	activatorTokenValidator,
	passwordChangeTokenValidator,
	passwordValidator,
	registrationValidator,
} from "@middlewares/validators.middleware";
import verifyJWT from "@middlewares/verifyJwt.middleware";

import UserController from "@controllers/user.controller";

export default class UserRoutes {
	public router;

	constructor(userController: UserController) {
		this.router = Router();
		this.setRoutes(userController);
	}

	private setRoutes(userController: UserController) {
		this.router.post(
			"/api/user/resend-verification-email",
			requestEmailLimiter,
			registrationValidator(),
			errorHandler,
			userController.resendVerificationEmail
		);

		this.router.get(
			"/api/user/activate",
			activatorTokenValidator(),
			errorHandler,
			userController.activateUser
		);

		this.router.post(
			"/api/user/request-password-change",
			requestEmailLimiter,
			registrationValidator(),
			errorHandler,
			userController.requestPasswordChange
		);

		this.router.post(
			"/api/user/change-password",
			[registrationValidator(), passwordChangeTokenValidator(), passwordValidator()],
			errorHandler,
			userController.changePassword
		);

		this.router.delete(
			"/api/user/delete", //
			verifyJWT,
			userController.deleteUser
		);
	}
}
