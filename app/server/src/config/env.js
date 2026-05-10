// This file must be the FIRST import in index.js.
// ES modules hoist ALL imports before executing any code, so
// dotenv.config() inside index.js runs AFTER passport.js is already
// evaluated. Putting dotenv.config() here guarantees it runs before
// any other config file that reads process.env.
import dotenv from 'dotenv';
dotenv.config();