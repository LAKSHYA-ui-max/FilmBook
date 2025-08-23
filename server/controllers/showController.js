import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

// --------------------
// Get Now Playing Movies (TMDB v4)
// --------------------
export const getNowPlayingMovies = async (req, res) => {
  try {
    const { data } = await axios.get("https://api.themoviedb.org/3/movie/now_playing", {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`, // TMDB v4 token
        accept: "application/json",
      },
    });

    const movies = data.results;
    res.json({ success: true, movies });
  } catch (error) {
    console.error("Error fetching now playing movies:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// --------------------
// Add a New Show
// --------------------
export const addShow = async (req, res) => {
  try {
    const { movieId, showInput, showPrice } = req.body;

    // Check if movie already exists in DB
    let movie = await Movie.findById(movieId);

    if (!movie) {
      // Fetch movie details and credits from TMDB v4
      const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
          headers: {
            Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
            accept: "application/json",
          },
        }),
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
          headers: {
            Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
            accept: "application/json",
          },
        }),
      ]);

      const movieData = movieDetailsResponse.data;
      const creditsData = movieCreditsResponse.data;

      const movieDetails = {
        _id: movieId,
        title: movieData.title,
        overview: movieData.overview,
        poster_path: movieData.poster_path,
        backdrop_path: movieData.backdrop_path,
        genres: movieData.genres,
        casts: creditsData.cast,
        release_date: movieData.release_date,
        original_language: movieData.original_language,
        tagline: movieData.tagline || "",
        vote_average: movieData.vote_average,
        runtime: movieData.runtime,
      };

      movie = await Movie.create(movieDetails);
    }

    // Prepare shows to insert
    const showsToCreate = [];
    showInput.forEach((show) => {
      const showDate = show.date;
      show.times.forEach((time) => {
        const dateTimeString = `${showDate}T${time}`;
        showsToCreate.push({
          movie: movieId,
          showDateTime: new Date(dateTimeString),
          showPrice,
          occupiedSeats: {},
        });
      });
    });

    if (showsToCreate.length > 0) {
      await Show.insertMany(showsToCreate);
    }

    // Trigger Inngest event
    await inngest.send({
      name: "app/show.added",
      data: { movieTitle: movie.title },
    });

    res.json({ success: true, message: "Show added successfully." });
  } catch (error) {
    console.error("Error adding show:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// --------------------
// Get All Shows (Upcoming)
// --------------------
export const getShows = async (req, res) => {
  try {
    const shows = await Show.find({ showDateTime: { $gte: new Date() } })
      .populate("movie")
      .sort({ showDateTime: 1 });

    // Return unique movies for now playing
    const uniqueMoviesMap = new Map();
    shows.forEach((show) => {
      uniqueMoviesMap.set(show.movie._id.toString(), show.movie);
    });

    const uniqueMovies = Array.from(uniqueMoviesMap.values());
    res.json({ success: true, shows: uniqueMovies });
  } catch (error) {
    console.error("Error fetching shows:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// --------------------
// Get Single Show (Movie)
// --------------------
export const getShow = async (req, res) => {
  try {
    const { movieId } = req.params;

    const shows = await Show.find({ movie: movieId, showDateTime: { $gte: new Date() } });
    const movie = await Movie.findById(movieId);

    const dateTime = {};
    shows.forEach((show) => {
      const date = show.showDateTime.toISOString().split("T")[0];
      if (!dateTime[date]) dateTime[date] = [];
      dateTime[date].push({ time: show.showDateTime, showId: show._id });
    });

    res.json({ success: true, movie, dateTime });
  } catch (error) {
    console.error("Error fetching show:", error.message);
    res.json({ success: false, message: error.message });
  }
};
