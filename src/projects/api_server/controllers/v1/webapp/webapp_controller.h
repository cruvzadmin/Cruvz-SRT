//==============================================================================
//
//  Cruvz Streaming - Web Application API Controller Header
//
//  Created for comprehensive web UI support
//  Copyright (c) 2024 Cruvz Technologies. All rights reserved.
//
//==============================================================================
#pragma once

#include "../controller_base.h"

namespace api
{
	namespace v1
	{
		class WebAppController : public Controller<WebAppController>
		{
		public:
			void PrepareHandlers() override;

		protected:
			// Authentication handlers
			ApiResponse OnPostAuthSignup(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnPostAuthSignin(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnPostAuthValidate(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnGetAuthMe(const std::shared_ptr<http::svr::HttpExchange> &client);

			// User management handlers
			ApiResponse OnGetUserProfile(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnPutUserProfile(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnPostChangePassword(const std::shared_ptr<http::svr::HttpExchange> &client);

			// Stream management handlers
			ApiResponse OnGetStreams(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnPostCreateStream(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnGetStream(const std::shared_ptr<http::svr::HttpExchange> &client, const std::shared_ptr<mon::HostMetrics> &vhost_metrics);
			ApiResponse OnPutUpdateStream(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnDeleteStream(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnPostStartStream(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnPostStopStream(const std::shared_ptr<http::svr::HttpExchange> &client);

			// Analytics handlers
			ApiResponse OnGetAnalyticsOverview(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnGetAnalyticsStreams(const std::shared_ptr<http::svr::HttpExchange> &client);

			// API Key management handlers
			ApiResponse OnGetAPIKeys(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnPostCreateAPIKey(const std::shared_ptr<http::svr::HttpExchange> &client);
			ApiResponse OnDeleteAPIKey(const std::shared_ptr<http::svr::HttpExchange> &client);

		private:
			// Utility functions
			ov::String GenerateJWT(const ov::String &email);
			bool ValidateJWT(const ov::String &token);
		};
	}  // namespace v1
}  // namespace api