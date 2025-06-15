import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, CompanyRegistration, insertUserSchema } from "@shared/schema";
import { nanoid } from "nanoid";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "ats-session-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // First try to get the user without a specific tenant (to support login)
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const registrationData: CompanyRegistration = req.body;
      
      console.log("Registration attempt for:", registrationData.username);
      
      // During initial registration, we don't have a company ID yet
      // This will do a global check for the email, which is fine for initial registration
      // as we want to ensure the new company admin's email is completely unique
      const existingUser = await storage.getUserByUsername(registrationData.username);
      if (existingUser) {
        console.log("Registration failed: Email already exists", registrationData.username);
        return res.status(400).json({ message: "Email address already exists" });
      }

      // Create company
      const company = await storage.createCompany({
        name: registrationData.companyName,
        industry: null,
        size: null,
      });
      
      console.log("Company created with ID:", company.id);

      // Create user with admin role
      const user = await storage.createUser({
        username: registrationData.username,
        email: registrationData.username, // Email and username are the same
        password: await hashPassword(registrationData.password),
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        fullName: registrationData.fullName,
        companyId: company.id,
        role: "admin"
      });
      
      console.log("User created with ID:", user.id);

      // Log in the user
      req.login(user, (err) => {
        if (err) {
          console.error("Auto-login after registration failed:", err);
          return next(err);
        }
        console.log("Registration successful and logged in:", user.username);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ 
          message: "Login failed. Please check your email and password." 
        });
      }
      
      req.login(user, (loginErr: Error | null) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        console.log("Login successful for:", user.username);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    if (req.user) {
      console.log("Logout attempt for user:", (req.user as SelectUser).username);
    }
    
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return next(err);
      }
      console.log("Logout successful");
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Unauthenticated request to /api/user");
      return res.sendStatus(401);
    }
    console.log("Authenticated user:", (req.user as SelectUser).username);
    res.json(req.user);
  });

  // Create a middleware to check if user is authenticated
  app.use("/api/jobs", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Unauthorized");
    }
    next();
  });

  app.use("/api/candidates", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Unauthorized");
    }
    next();
  });

  app.use("/api/companies", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Unauthorized");
    }
    next();
  });
}

export function generateApplicationLink() {
  return nanoid(10);
}
