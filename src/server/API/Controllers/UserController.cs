﻿// Copyright (c) 2022, UW Medicine Research IT, University of Washington
// Developed by Nic Dobbins and Cliff Spital, CRIO Sean Mooney
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using Model.Options;
using Model.Authentication;
using Model.Authorization;
using API.Jwt;
using API.DTO.User;
using System.IdentityModel.Tokens.Jwt;

namespace API.Controllers
{
    [Produces("application/json")]
    [Route("api/user")]
    public class UserController : Controller
    {
        readonly ILogger<UserController> logger;
        readonly AuthenticationOptions authenticationOptions;
        readonly LeafVersionOptions versionOptions;
        readonly CohortOptions cohortOptions;
        readonly ClientOptions clientOptions;
        readonly IUserJwtProvider jwtProvider;
        readonly IUserContext userContext;

        public UserController(
            ILogger<UserController> logger,
            IOptions<AuthenticationOptions> authenticationOptions,
            IOptions<LeafVersionOptions> versionOptions,
            IOptions<CohortOptions> cohortOptions,
            IOptions<ClientOptions> clientOptions,
            IUserJwtProvider userJwtProvider,
            IUserContext userContext)
        {
            this.logger = logger;
            this.authenticationOptions = authenticationOptions.Value;
            this.versionOptions = versionOptions.Value;
            this.cohortOptions = cohortOptions.Value;
            this.clientOptions = clientOptions.Value;
            this.userContext = userContext;
            jwtProvider = userJwtProvider;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<ActionResult<IdTokenDTO>> GetUser()
        { 
            try
            {
                logger.LogDebug("Attempting to generate ID token for user: {User}", HttpContext.User?.Identity?.Name ?? "anonymous");
                var login = await jwtProvider.IdToken(HttpContext);
                
                logger.LogInformation("Successfully generated ID token for user");
                return Ok(new IdTokenDTO { IdToken = login });
            }
            catch (LeafAuthenticationException lae)
            {
                logger.LogError("User is not authorized to use Leaf. Error:{Error} User:{user}", lae.Message, HttpContext.User);
                return StatusCode(StatusCodes.Status403Forbidden);
            }
            catch (Exception e)
            {
                logger.LogError("Failed to produce identity token. Error:{Error}", e.ToString());
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }

        [Authorize(Policy = TokenType.Id)]
        [Authorize(Policy = Access.Institutional)]
        [HttpGet("attest")]
        public ActionResult<AccessTokenDTO> Attest(
            [FromQuery] Attestation attestation,
            [FromServices] IInvalidatedTokenCache invalidatedCache)
        {
            if (authenticationOptions.Mechanism != userContext.AuthenticationMechanism)
            {
                return StatusCode(StatusCodes.Status401Unauthorized);
            }

            try
            {
                if (invalidatedCache.IsInvalidated(userContext.IdNonce))
                {
                    logger.LogWarning("Id token is invalidated. IdNonce:{IdNonce} Attestation:{@Attestation}", userContext.IdNonce, attestation);
                    return StatusCode(StatusCodes.Status401Unauthorized);
                }

                var token = jwtProvider.AccessToken(HttpContext, attestation);

                logger.LogInformation("Created Access Token. Attestation:{@Attestation} Token:{Token}", attestation, token);

                return Ok(new AccessTokenDTO { AccessToken = token });
            }
            catch (Exception e)
            {
                logger.LogError("Failed to produce access token. Attestation:{@Attestation} Error:{Error}", attestation, e.ToString());
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }

        [Authorize(Policy = TokenType.Access)]
        [Authorize(Policy = Access.Institutional)]
        [HttpGet("refresh")]
        public ActionResult<AccessTokenDTO> Refresh([FromServices] IInvalidatedTokenCache invalidatedCache)
        {
            if (authenticationOptions.Mechanism != userContext.AuthenticationMechanism)
            {
                return StatusCode(StatusCodes.Status401Unauthorized);
            }

            try
            {
                if (invalidatedCache.IsInvalidated(userContext.IdNonce))
                {
                    logger.LogWarning("Id token is invalidated. IdNonce:{IdNonce} Attestation:{@Attestation}", userContext.IdNonce);
                    return StatusCode(StatusCodes.Status401Unauthorized);
                }

                var token = jwtProvider.AccessToken(HttpContext);

                logger.LogInformation("Refreshed Access Token. Token:{Token}", token);

                return Ok(new AccessTokenDTO { AccessToken = token });
            }
            catch (Exception e)
            {
                logger.LogError("Failed to refresh access token. Error:{Error}", e.ToString());
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }

        [Authorize(Policy = TokenType.Id)]
        [Authorize(Policy = Access.Institutional)]
        [HttpPost("logout")]
        public async Task<ActionResult<LogoutDTO>> LogoutAsync([FromServices] IInvalidatedTokenService invalidatedService)
        {
            if (authenticationOptions.IsUnsecured || !authenticationOptions.Logout.Enabled)
            {
                return StatusCode(StatusCodes.Status404NotFound);
            }

            var nonce = User.FindFirst(Nonce.Id).Value;
            var ticks = Convert.ToInt64(User.FindFirst(JwtRegisteredClaimNames.Exp).Value);
            var token = InvalidatedToken.FromUTCTicks(nonce, ticks);
            try
            {
                logger.LogInformation("Invalidating Token: {@Token}", token);
                await invalidatedService.Invalidate(token);
            }
            catch (Exception e)
            {
                logger.LogError("Failed to logout user. Error:{Error}", e.ToString());
            }

            return Ok(new LogoutDTO { LogoutURI = authenticationOptions.Logout.URI?.AbsoluteUri });
        }
    }
}
