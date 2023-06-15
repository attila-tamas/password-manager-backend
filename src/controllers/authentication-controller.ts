import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

import "dotenv/config";

import AccountActivationEmailTemplate from "@templates/account-activation-email";
import { sender, transport } from "@util/transport";

import Controller from "@interfaces/controller-interface";
import userModel from "@models/user-model";
import AuthenticationRoutes from "@routes/authentication-routes";

export default class AuthenticationController implements Controller {
	public router;

	private user;
	private authRoutes;
	private transport;

	constructor() {
		this.authRoutes = new AuthenticationRoutes(this);
		this.router = this.authRoutes.router;

		this.user = userModel;
		this.transport = transport;
	}

	// @route POST /api/auth/register
	// @access Public
	public registerUser = async (req: Request, res: Response) => {
		try {
			const email = req.body.email;
			const password = await bcrypt.hash(req.body.password, 10);
			const activatorToken = uuidv4();

			const createdUser = await this.user.create({
				email,
				password,
				activatorToken,
			});

			await this.transport.send({
				to: email,
				from: sender,
				subject: "Account activation",
				html: AccountActivationEmailTemplate(createdUser.activatorToken),
			});

			return res.status(200).json({ message: `New user '${createdUser.email}' created` });
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};

	// @route POST /api/auth/login
	// @access Public
	public loginUser = async (req: Request, res: Response) => {
		try {
			const email = req.body.email;

			const user = await this.user.findOne({ email }).exec();

			const accessToken = jwt.sign(
				{
					UserInfo: {
						id: user?._id,
						email: user?.email,
					},
				},
				process.env["ACCESS_TOKEN_SECRET"] as string,
				{ expiresIn: "10m" } // was 10s
			);

			const refreshToken = jwt.sign(
				{ email: user?.email },
				process.env["REFRESH_TOKEN_SECRET"] as string,
				{ expiresIn: "1d" }
			);

			res.cookie("jwt", refreshToken, {
				httpOnly: true,
				// secure: true,
				sameSite: "none",
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});

			return res.status(200).json({ accessToken });
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};

	// @route POST /api/auth/logout
	// @access Public
	public logoutUser = async (req: Request, res: Response) => {
		try {
			const jwt = req.cookies.jwt;

			if (jwt) {
				res.clearCookie("jwt", { httpOnly: true, /*secure: true,*/ sameSite: "none" });
			}

			return res.status(200).json({ message: "User logged out" });
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};

	// @route GET /api/auth/refresh
	// @access Public
	public refreshToken = async (req: Request, res: Response): Promise<any> => {
		try {
			const cookies = req.cookies;
			const refreshToken = cookies.jwt;

			jwt.verify(
				refreshToken,
				process.env["REFRESH_TOKEN_SECRET"] as string,
				async (error: any, decoded: any) => {
					if (error) {
						return res.status(400).json({ message: "Forbidden" });
					}

					const user = await this.user.findOne({ email: decoded.email }).exec();

					if (!user) {
						return res.status(400).json({ message: "Unauthorized" });
					}

					const accessToken = jwt.sign(
						{
							UserInfo: {
								id: user._id,
								email: user.email,
							},
						},
						process.env["ACCESS_TOKEN_SECRET"] as string,
						{ expiresIn: "10m" }
					);

					return res.status(200).json({ accessToken });
				}
			);
		} catch (error: any) {
			return res.status(500).json({ message: error.message });
		}
	};

	// @route GET /api/auth/current
	// @access Protected
	public getCurrentUser = async (req: Request, res: Response) => {
		try {
			return res.status(200).json((<any>req).user);
		} catch (error: any) {
			return res.status(500).json({ error: error.message });
		}
	};
}
