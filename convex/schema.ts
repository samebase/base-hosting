import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One document for each guest. The auth components keep the accounts and sessions.
  users: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),
  todos: defineTable({
    userId: v.id("users"),
    text: v.string(),
    done: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_user_created_at", ["userId", "createdAt"]),
});
