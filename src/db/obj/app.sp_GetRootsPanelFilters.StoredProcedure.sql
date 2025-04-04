-- Copyright (c) 2022, UW Medicine Research IT, University of Washington
-- Developed by Nic Dobbins and Cliff Spital, CRIO Sean Mooney
-- This Source Code Form is subject to the terms of the Mozilla Public
-- License, v. 2.0. If a copy of the MPL was not distributed with this
-- file, You can obtain one at http://mozilla.org/MPL/2.0/.
﻿USE [LeafDB]
GO
/****** Object:  StoredProcedure [app].[sp_GetRootsPanelFilters]    Script Date: ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


-- =======================================
-- Author:      Cliff Spital
-- Create date: 2018/9/14
-- Description: Gets roots and panel filters, in the first and second result set respecively.
-- =======================================
CREATE PROCEDURE [app].[sp_GetRootsPanelFilters]
    @user auth.[User],
    @groups auth.GroupMembership READONLY,
    @admin bit = 0,
    @datasetId uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON

    EXEC app.sp_GetRootConcepts @user, @groups, @admin = @admin, @datasetId = @datasetId;

    SELECT
        f.Id,
        f.ConceptId,
        ConceptUniversalId = c.UniversalId,
        f.IsInclusion,
        f.UiDisplayText,
        f.UiDisplayDescription
    FROM
        app.PanelFilter f
    JOIN app.Concept c on f.ConceptId = c.Id
    WHERE (dataset_id IS NOT NULL AND dataset_id = @datasetId);
END

GO
