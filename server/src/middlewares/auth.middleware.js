import { Token } from "../models/tokens.models.js";
import { User } from "../models/user.models.js";
import { APIError } from "../utils/APIerror.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from 'jsonwebtoken'
export const verifyJWT = asyncHandler(async(req,res,next)=>{
    try {
        const token = req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "")
        if(!token){
            throw new APIError(401,"No Access Token Provided")
        }
        const tokenData = await Token.findOne({uuid:token})
        if(!tokenData){
            throw new APIError(401,"Invalid Access Token")
        }
        const userFound = jwt.verify(token,process.env.JWT_SECRET_KEY)
        if(!user){
            throw new APIError(401,"Invalid Access Token")
        }
        const user = userFound
        req.user = user
        next()
    } catch (error) {
        throw new APIError(401,error?.message || "Invalid Access Token")
    }
})

