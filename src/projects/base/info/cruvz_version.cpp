//==============================================================================
//
//  Cruvz Streaming
//
//  Created by Hyunjun Jang
//  Copyright (c) 2022 Cruvz. All rights reserved.
//
//==============================================================================
#include "cruvz_version.h"

namespace info
{
	void CruvzVersion::SetVersion(const ov::String &version, const ov::String &git_version)
	{
		_version = version;
		_git_extra = git_version;

#if DEBUG
		static constexpr const char *BUILD_MODE = " [debug]";
#else	// DEBUG
		static constexpr const char *BUILD_MODE = "";
#endif	// DEBUG

		_description.Format("v%s (%s)%s", _version.CStr(), _git_extra.CStr(), BUILD_MODE);
	}

}  // namespace info
