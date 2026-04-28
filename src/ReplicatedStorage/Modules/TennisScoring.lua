-- Spike Tennis — tennis scoring module
local TennisScoring = {}
TennisScoring.__index = TennisScoring

local POINT_DISPLAY = { [0] = "0", [1] = "15", [2] = "30", [3] = "40", [4] = "AD" }

function TennisScoring.new()
    local self = setmetatable({}, TennisScoring)
    self:reset()
    return self
end

function TennisScoring:reset()
    self.points  = { 0, 0 }   -- current game points per player (0-4)
    self.games   = { 0, 0 }
    self.sets    = { 0, 0 }
    self.server  = 1          -- player index (1 or 2) who is serving
    self.deuce   = false
    self.advantage = 0        -- 0 = none, 1 or 2 = that player has advantage
    self.matchOver = false
    self.winner    = 0
end

-- Award a point to playerIndex (1 or 2)
-- Returns: table { type, winner, gameWinner, setWinner, matchWinner, message }
function TennisScoring:awardPoint(playerIndex)
    if self.matchOver then return { type = "none" } end

    local other = playerIndex == 1 and 2 or 1
    local result = {}

    if self.deuce then
        if self.advantage == 0 then
            self.advantage = playerIndex
            result.type = "advantage"
            result.message = "ADVANTAGE P" .. playerIndex
        elseif self.advantage == playerIndex then
            -- Win the game
            return self:_awardGame(playerIndex)
        else
            -- Back to deuce
            self.advantage = 0
            result.type = "deuce"
            result.message = "DEUCE"
        end
        return result
    end

    self.points[playerIndex] = self.points[playerIndex] + 1

    -- Check for deuce (both at 3 = 40-40)
    if self.points[1] == 3 and self.points[2] == 3 then
        self.deuce = true
        self.advantage = 0
        result.type = "deuce"
        result.message = "DEUCE"
        return result
    end

    -- Win the game
    if self.points[playerIndex] >= 4 then
        return self:_awardGame(playerIndex)
    end

    result.type = "point"
    result.message = self:getScoreString()
    return result
end

function TennisScoring:_awardGame(playerIndex)
    local result = {}
    self.points = { 0, 0 }
    self.deuce = false
    self.advantage = 0
    self.games[playerIndex] = self.games[playerIndex] + 1

    -- Switch server every game
    self.server = self.server == 1 and 2 or 1

    -- Check set win (first to 6, must lead by 2; tiebreak at 6-6)
    local g1, g2 = self.games[1], self.games[2]
    local other = playerIndex == 1 and 2 or 1

    if g1 == 7 or g2 == 7 or
       (math.max(g1, g2) >= 6 and math.abs(g1 - g2) >= 2) then
        return self:_awardSet(playerIndex)
    end

    result.type = "game"
    result.winner = playerIndex
    result.message = "GAME P" .. playerIndex .. "  " .. g1 .. " - " .. g2
    return result
end

function TennisScoring:_awardSet(playerIndex)
    local result = {}
    self.sets[playerIndex] = self.sets[playerIndex] + 1
    self.games = { 0, 0 }

    -- Best of 3 sets
    if self.sets[playerIndex] >= 2 then
        self.matchOver = true
        self.winner = playerIndex
        result.type = "match"
        result.winner = playerIndex
        result.message = "MATCH WIN  P" .. playerIndex .. "  " ..
            self.sets[1] .. " - " .. self.sets[2]
    else
        result.type = "set"
        result.winner = playerIndex
        result.message = "SET P" .. playerIndex .. "  " ..
            self.sets[1] .. " - " .. self.sets[2]
    end
    return result
end

function TennisScoring:getScoreString()
    local p1 = self.deuce and (self.advantage == 1 and "AD" or "40") or POINT_DISPLAY[self.points[1]]
    local p2 = self.deuce and (self.advantage == 2 and "AD" or "40") or POINT_DISPLAY[self.points[2]]
    return p1 .. " - " .. p2
end

function TennisScoring:getFullScoreTable()
    return {
        points  = { self:getScoreString() },
        games   = { self.games[1], self.games[2] },
        sets    = { self.sets[1],  self.sets[2]  },
        server  = self.server,
        deuce   = self.deuce,
        adv     = self.advantage,
    }
end

return TennisScoring
