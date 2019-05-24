import { Context } from "koa";
import { verify } from "./jwt";
import { get as getConfig } from "./config";
import { join } from "path";
import getPermissions from "./permissions";
import send = require("koa-send");

function invalidPath(ctx: Context) {
  ctx.status = 400;
  ctx.body = "Invalid path.";
}

function invalidToken(ctx: Context) {
  ctx.status = 403;
  ctx.body = "Invalid token. Access denied.";
}

function accessDenied(ctx: Context) {
  ctx.status = 403;
  ctx.body = "Access denied.";
}

export default async function sendFile(ctx: Context) {
  return ctx.path.indexOf("..") !== -1
    ? invalidPath(ctx)
    : await (async () => {
        const config = getConfig();

        // First we gotta see if the requested path is publicly accessible
        const joinedPath = join(config.root, ctx.path);

        // Make sure the joined path falls under root.
        // It should anyway (due to prior checks), but we can't be wrong here.
        const isInsideRootDir = joinedPath.startsWith(config.root);

        return !isInsideRootDir
          ? invalidPath(ctx)
          : await (async () => {
              const token = ctx.cookies.get("jwt_auth_service_token");
              if (token) {
                const jwt = verify(token);
                if (jwt.valid) {
                  const permissions = getPermissions(
                    ctx.path,
                    jwt.value,
                    config
                  );

                  if (permissions.r) {
                    await send(ctx, ctx.path, { root: config.root });
                  } else {
                    accessDenied(ctx);
                  }
                } else {
                  invalidToken(ctx);
                }
              } else {
                invalidToken(ctx);
              }
            })();
      })();
}