-- Spike Tennis — MatchManager
-- Tracks scoring and fires events when score changes.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TennisScoring = require(ReplicatedStorage.Modules.TennisScoring)

local MatchManager = {}

local score = TennisScoring.new()
local Remotes

function MatchManager.init(remotes)
    Remotes = remotes
    score:reset()
end

function MatchManager.awardPoint(playerIndex)
    local result = score:awardPoint(playerIndex)
    MatchManager._broadcast(result)
    return result
end

function MatchManager.getScoreTable()
    return score:getFullScoreTable()
end

function MatchManager.getServer()
    return score.server
end

function MatchManager.isMatchOver()
    return score.matchOver
end

function MatchManager.getWinner()
    return score.winner
end

function MatchManager.reset()
    score:reset()
    MatchManager._broadcast({ type = "reset", message = "NEW MATCH" })
end

function MatchManager._broadcast(result)
    if Remotes and Remotes.ScoreUpdate then
        Remotes.ScoreUpdate:FireAllClients(score:getFullScoreTable(), result)
    end
end

return MatchManager
