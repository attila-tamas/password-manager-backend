import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

import AccountActivationEmailTemplate from "@templates/account-activation-email";
import PasswordChangeRequestEmailTemplate from "@templates/password-change-request-email";
import { sender, transport } from "@util/transport";

import Controller from "@interfaces/controller-interface";
import keyModel from "@models/key-model";
import userModel from "@models/user-model";
import UserRoutes from "@routes/user-routes";

export default class UserController implements Controller {
	public router: any;

	private user;
	private key;
	private userRoutes;
	private transport;

	constructor() {
		this.userRoutes = new UserRoutes(this);
		this.router = this.userRoutes.router;

		this.user = userModel;
		this.key = keyModel;
		this.transport = transport;
	}

	// @route POST /api/auth/resend-verification-email
	// @access Public
	public ResendVerificationEmail = async (req: Request, res: Response) => {
		try {
			const email = req.body.email;

			const user = await this.user.findOne({ email }).exec();

			await this.transport.send({
				to: email,
				from: sender,
				subject: "Account activation",
				html: AccountActivationEmailTemplate(user?.activatorToken),
			});

			return res.status(200).json({ message: "New email sent." });
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};

	// @route GET /api/auth/activate?token=...
	// @access Public
	public activateUser = async (req: Request, res: Response) => {
		try {
			const activatorToken = req.query["token"];

			await this.user.updateOne(
				{ activatorToken },
				{ $unset: { activatorToken }, $set: { active: true } }
			);

			return res.status(200).json({ message: "Account activated" });
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};

	// @route POST /api/user/request-password-change
	// @access Public
	public RequestPasswordChange = async (req: Request, res: Response) => {
		try {
			const email = req.body.email;

			const user = await this.user.findOne({ email }).exec();

			const passwordChangeToken = jwt.sign(
				{
					UserInfo: {
						id: user?._id,
						email: user?.email,
					},
				},
				(process.env["ACCESS_TOKEN_SECRET"] as string) + user?.password,
				{ expiresIn: "10m" }
			);

			await this.transport.send({
				to: email,
				from: sender,
				subject: "Password change request",
				html: PasswordChangeRequestEmailTemplate(user?._id, passwordChangeToken),
			});

			return res.status(200).json({ message: "Password change link sent" });
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};

	// @route POST /api/user/change-password?id=...&token=...
	// @access Public
	public ChangePassword = async (req: Request, res: Response): Promise<any> => {
		try {
			const { id, token } = req.query;
			const password = await bcrypt.hash(req.body.password, 10);

			const user = await this.user.findOne({ _id: id }).exec();

			jwt.verify(
				token as string,
				(process.env["ACCESS_TOKEN_SECRET"] as string) + user?.password,
				async (error: any) => {
					if (error) {
						return res.status(400).json({ message: "Forbidden" });
					}

					if (!user) {
						return res.status(400).json({ message: "Unauthorized" });
					}

					await this.user.updateOne({ _id: id }, { $set: { password } });

					return res.status(200).json({ message: "Password changed" });
				}
			);
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};

	// @route DELETE /api/user/delete
	// @access Protected
	public DeleteUser = async (req: Request, res: Response) => {
		try {
			const deletedUser = await this.user
				.findByIdAndDelete({ _id: (<any>req).user.id })
				.exec();

			if (!deletedUser) {
				return res.status(200).json({ message: "User not found" });
			}

			await this.key.deleteMany({ userId: (<any>req).user.id }).exec();

			res.clearCookie("jwt", { httpOnly: true, /*secure: true,*/ sameSite: "none" });

			return res.status(200).json({ message: "Account deleted" });
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};
}
