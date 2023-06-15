import { model, Schema } from "mongoose";

const userSchema = new Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
		},
		password: {
			type: String,
			required: true,
		},
		active: {
			type: Boolean,
			default: false,
		},
		activatorToken: String,
	},
	{ versionKey: false }
);

const userModel = model("User", userSchema);

export default userModel;
