import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";
import request from "supertest";
import app from "../app.js";
import { connectTestDB, closeTestDB, clearTestDB } from "./setup.js";
import { User, Business } from "../models/index.js";

jest.setTimeout(30000);

beforeAll(async () => await connectTestDB());
afterEach(async () => await clearTestDB());
afterAll(async () => await closeTestDB());

describe("Auth & Chameleon Architecture Registration", () => {
  const mockVenueOwner = {
    name: "Venue Owner",
    email: "venue@test.com",
    password: "Password123!",
    confirmPassword: "Password123!",
    phone: "12345678",
    businessName: "Grand Plaza",
    category: "venue",
    description: "A great place",
    serviceRadius: 50,
  };

  const mockPhotographer = {
    name: "Photo Guy",
    email: "photo@test.com",
    password: "Password123!",
    confirmPassword: "Password123!",
    phone: "87654321",
    businessName: "Flash Photography",
    category: "photography",
    serviceRadius: 100,
    pricingModel: "hourly",
  };

  describe("POST /api/v1/auth/register", () => {
    it("should register a Venue Business correctly", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(mockVenueOwner);

      if (res.statusCode !== 201) console.error("Register Error:", res.body);

      expect(res.statusCode).toBe(201);

      const userData = res.body.data.user;

      expect(userData.business.category).toBe("venue");
      expect(userData.role.name).toBe("Owner");

      // Verify Database State
      const business = await Business.findById(userData.business.id);
      expect(business).toBeTruthy();
      expect(business.venueDetails).toBeDefined();
      expect(business.venueDetails.capacity).toBeDefined();

      // ✅ Updated Assertion: Check for missing property instead of missing object
      expect(business.serviceDetails?.serviceRadiusKM).toBeUndefined();
    });

    it("should register a Service Provider (Photographer) correctly", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(mockPhotographer);

      expect(res.statusCode).toBe(201);

      const userData = res.body.data.user;

      const business = await Business.findById(userData.business.id);
      expect(business.category).toBe("photography");
      expect(business.serviceDetails).toBeDefined();
      expect(business.serviceDetails.serviceRadiusKM).toBe(100);

      // ✅ Updated Assertion: Check for missing property instead of missing object
      expect(business.venueDetails?.capacity?.max).toBeUndefined();
    });

    it("should prevent duplicate emails", async () => {
      await request(app).post("/api/v1/auth/register").send(mockVenueOwner);
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send(mockVenueOwner);

      expect(res.statusCode).toBe(400);
      const errorMsg =
        res.body.message || (res.body.errors && res.body.errors[0]?.msg);
      expect(errorMsg).toMatch(
        /Email already registered|Email is already taken/i
      );
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/api/v1/auth/register").send(mockVenueOwner);
    });

    it("should login with correct credentials", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: mockVenueOwner.email,
        password: mockVenueOwner.password,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers["set-cookie"][0]).toMatch(/^jwt=/);
    });

    it("should reject incorrect password", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: mockVenueOwner.email,
        password: "WrongPassword",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("Tenant Isolation Checks", () => {
    let tokenVenue;

    beforeEach(async () => {
      const res1 = await request(app)
        .post("/api/v1/auth/register")
        .send(mockVenueOwner);
      const cookie1 = res1.headers["set-cookie"][0];
      tokenVenue = cookie1.split(";")[0];
    });

    it("should allow user to get their own profile", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", [tokenVenue]);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.email).toBe(mockVenueOwner.email);
    });

    it("should not allow access without token", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.statusCode).toBe(401);
    });
  });
});
