import express from "express"
import { addShow, getNowPlayingMovies, getShow, getShows } from "../controllers/showController.js"
import { protectAdmin } from "../middleware/auth.js"

const showRouter = express.Router()

// Get all now playing movies (for selection in AddShows page)
showRouter.get("/now-playing", getNowPlayingMovies);

// Add a new show (protected, only admin can add)
showRouter.post("/add", protectAdmin, addShow); // ✅ Changed to POST

// Get all upcoming shows (for dashboard / movie listings)
showRouter.get("/all", getShows);

// Get single movie show details (for movie details page)
showRouter.get("/:movieId", getShow);


export default showRouter