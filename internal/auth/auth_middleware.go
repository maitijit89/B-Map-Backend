package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates the JWT token from the Authorization header, checks revocation status,
// and ensures the user is not suspended.
func AuthMiddleware(jwtService *JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Authorization header is required",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid Authorization header format. Format must be 'Bearer <token>'",
			})
			c.Abort()
			return
		}

		tokenString := strings.TrimSpace(parts[1])
		claims, err := jwtService.ValidateAccessToken(c.Request.Context(), tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   err.Error(),
			})
			c.Abort()
			return
		}

		// Enforce account suspension check
		if claims.Status == "suspended" {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Your account has been suspended by an administrator. Please contact support.",
			})
			c.Abort()
			return
		}

		// Inject User ID, Email, Role, and Status into Gin context
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Set("status", claims.Status)
		c.Set("claims", claims)

		c.Next()
	}
}

// AdminMiddleware ensures that the authenticated user has the "admin" role.
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists || role != "admin" {
			// Also check claims directly
			if val, ok := c.Get("claims"); ok {
				if claims, okClaims := val.(*CustomClaims); okClaims && claims.Role == "admin" {
					c.Next()
					return
				}
			}
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Access denied. Administrator privileges required.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
