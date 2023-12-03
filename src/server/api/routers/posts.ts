import { clerkClient } from "@clerk/nextjs";
import type { User } from "@clerk/nextjs/dist/types/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, privateProcedure, publicProcedure } from "~/server/api/trpc";

const filterUserForClient = (user: User) => {
  return {
    id: user.id,
    username: user.username,
    profileImageUrl: user.imageUrl,
  };
};

export const postsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.db.post.findMany({
      take: 100,
      orderBy: [{createdAt: "desc"}]
    });

    const users = (
      await clerkClient.users.getUserList({
        userId: posts.map((p) => p.authorId),
        limit: 100,
      })
    ).map(filterUserForClient);

    return posts.map((post) => {

      const author = users.find((u) => u.id === post.authorId)
      if (!author?.username)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Author for post not found",
        })

      return {
        post,
        author,
      };
    });
  }),

  create: privateProcedure.input(z.object({
    content: z.string().emoji().min(1).max(250),
  })).mutation(async ({ ctx, input }) => {
    const authorId = ctx.currentUser;

    const post = await ctx.db.post.create({
      data: {
        authorId,
        content: input.content,
      }
    });

    return post;
  })
});
