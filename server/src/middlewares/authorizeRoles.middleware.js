const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: {
          message: "Unauthorized: Role not found",
        },
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Access denied: ${userRole} is not authorized`,
        },
      });
    }

    next();
  };
};

export default authorizeRoles;
