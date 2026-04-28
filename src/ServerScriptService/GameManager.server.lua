-- Spike Tennis — GameManager
-- Central state machine: Waiting → Serving → Rally → PointEnd → (loop or MatchOver)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Constants    = require(ReplicatedStorage.Modules.Constants)
local BallController = require(script.Parent.BallController)
local MatchManager   = require(script.Parent.MatchManager)
local C = Constants

-- ─── Create RemoteEvents ────────────────────────────────────────────────────
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local function makeRemote(name, class)
    local r = Instance.new(class or "RemoteEvent")
    r.Name = name
    r.Parent = Remotes
    return r
end

local RE = {
    HitRequest   = makeRemote("HitRequest"),      -- client → server: wants to hit
    ServeRequest = makeRemote("ServeRequest"),     -- client → server: wants to serve
    BallHit      = makeRemote("BallHit"),          -- server → all clients: hit happened
    ScoreUpdate  = makeRemote("ScoreUpdate"),      -- server → all clients: score changed
    GameState    = makeRemote("GameState"),        -- server → all clients: state changed
    PlayerAssign = makeRemote("PlayerAssign"),     -- server → client: your side
    ShowMessage  = makeRemote("ShowMessage"),      -- server → all: big screen message
    TimingInfo   = makeRemote("TimingInfo"),       -- server → client: ball incoming
}

BallController.init(RE)
MatchManager.init(RE)

-- ─── State ──────────────────────────────────────────────────────────────────
local STATE = {
    WAITING   = "Waiting",
    SERVING   = "Serving",
    RALLY     = "Rally",
    POINT_END = "PointEnd",
    MATCH_OVER = "MatchOver",
}

local state       = STATE.WAITING
local players     = {}     -- [1] and [2] = Player objects
local sides       = {}     -- player.UserId → side index (1 or 2)
local hitCooldown = {}     -- player.UserId → last hit tick

-- Spawn positions for each side (P1 = positive Z, P2 = negative Z)
local SPAWN = {
    Vector3.new(0, 1,  C.COURT.HALF_LENGTH - 4),
    Vector3.new(0, 1, -C.COURT.HALF_LENGTH + 4),
}

-- ─── Helper: broadcast state ────────────────────────────────────────────────
local function setState(newState, data)
    state = newState
    RE.GameState:FireAllClients(newState, data or {})
    print("[GameManager] State →", newState)
end

local function showMessage(msg, duration)
    RE.ShowMessage:FireAllClients(msg, duration or 2.5)
end

-- ─── Assign players ─────────────────────────────────────────────────────────
local function assignPlayers()
    local plrs = Players:GetPlayers()
    players = {}
    sides = {}
    for i, plr in ipairs(plrs) do
        if i > 2 then break end
        players[i] = plr
        sides[plr.UserId] = i
        RE.PlayerAssign:FireClient(plr, i, SPAWN[i])
    end
end

local function teleportToSpawns()
    for i, plr in ipairs(players) do
        local char = plr.Character
        if char then
            local root = char:FindFirstChild("HumanoidRootPart")
            if root then
                root.CFrame = CFrame.new(SPAWN[i] + Vector3.new(0, 3, 0))
            end
        end
    end
end

-- ─── Point lifecycle ────────────────────────────────────────────────────────
local function startPoint()
    BallController.resetBall()
    BallController.setActive(false)

    local serverIdx = MatchManager.getServer()
    showMessage("P" .. serverIdx .. " TO SERVE", 1.5)
    task.wait(1.5)

    setState(STATE.SERVING, { server = serverIdx })
    BallController.placeBallForServe(serverIdx, SPAWN)

    -- Tell server client they can hit
    if players[serverIdx] then
        RE.TimingInfo:FireClient(players[serverIdx], "serve_ready")
    end
end

local function endPoint(winnerIdx, reason)
    BallController.setActive(false)
    setState(STATE.POINT_END)

    local msgMap = {
        double_bounce = "P" .. winnerIdx .. " POINT  ·  2 BOUNCES",
        net           = "NET FAULT  ·  P" .. winnerIdx .. " POINT",
        out           = "OUT  ·  P" .. winnerIdx .. " POINT",
        ace           = "ACE!  P" .. winnerIdx .. " POINT",
        double_fault  = "DOUBLE FAULT  ·  P" .. winnerIdx .. " POINT",
    }
    showMessage(msgMap[reason] or "P" .. winnerIdx .. " POINT", 2)

    local result = MatchManager.awardPoint(winnerIdx)

    task.wait(0.4)
    -- Show scoring message
    if result.message then
        showMessage(result.message, 2.2)
    end
    task.wait(C.GAME.POINT_DELAY)

    if MatchManager.isMatchOver() then
        setState(STATE.MATCH_OVER)
        showMessage("🏆 P" .. MatchManager.getWinner() .. " WINS THE MATCH!", 5)
        task.wait(6)
        MatchManager.reset()
        assignPlayers()
        teleportToSpawns()
        task.wait(1)
        startPoint()
    else
        startPoint()
    end
end

-- ─── Ball event wiring ───────────────────────────────────────────────────────
BallController.onBounce(function(pos, count, lastHitter)
    if state ~= STATE.RALLY then return end

    -- Determine which side of the court the bounce is on
    local side = pos.Z > 0 and 1 or 2   -- side 1 = positive Z = P1's side

    if count == 1 then
        -- Notify the player on that side that the ball is incoming
        local targetIdx = side
        if players[targetIdx] then
            RE.TimingInfo:FireClient(players[targetIdx], "incoming", pos)
        end
    elseif count >= 2 then
        -- Two bounces = point to the last hitter
        local winner = lastHitter == 0 and (side == 1 and 2 or 1) or
            (lastHitter == 1 and 1 or 2)
        -- Actually: the player who DIDN'T return the ball loses the point
        -- Last hitter hit it, it bounced twice on opponent's side → last hitter wins
        local loserSide = side
        local winnerSide = loserSide == 1 and 2 or 1
        endPoint(winnerSide, "double_bounce")
    end
end)

BallController.onNet(function(lastHitter)
    if state ~= STATE.RALLY and state ~= STATE.SERVING then return end
    local loser = lastHitter
    local winner = loser == 1 and 2 or 1
    if loser == 0 then return end
    endPoint(winner, "net")
end)

-- ─── Client hit request ─────────────────────────────────────────────────────
RE.HitRequest.OnServerEvent:Connect(function(player, targetPos, shotType)
    if state ~= STATE.RALLY then return end

    local playerIdx = sides[player.UserId]
    if not playerIdx then return end

    -- Cooldown check (prevent spam)
    local now = tick()
    if hitCooldown[player.UserId] and now - hitCooldown[player.UserId] < 0.3 then return end
    hitCooldown[player.UserId] = now

    local char = player.Character
    if not char then return end
    local root = char:FindFirstChild("HumanoidRootPart")
    if not root then return end

    local ball = BallController.getBall()
    if not ball then return end

    -- Validate range
    local dist = (root.Position - ball.Position).Magnitude
    if dist > C.SHOTS.HIT_RANGE then
        showMessage("TOO FAR!", 1)
        return
    end

    -- Timing quality: based on ball velocity approaching/passing optimal height (1.2 studs)
    local ballY = ball.Position.Y - root.Position.Y
    local optimalY = 1.2
    local deviation = math.abs(ballY - optimalY)
    local maxDev = 3.0
    local timingQuality = math.clamp(1 - deviation / maxDev, 0, 1)

    -- Sanitize target
    if typeof(targetPos) ~= "Vector3" then
        targetPos = Vector3.new(0, 0, playerIdx == 1 and -30 or 30)
    end
    -- Clamp target to valid opponent court area
    local oppZ = playerIdx == 1 and -1 or 1
    targetPos = Vector3.new(
        math.clamp(targetPos.X, -C.COURT.HALF_WIDTH / 2 + 1, C.COURT.HALF_WIDTH / 2 - 1),
        0.5,
        math.clamp(targetPos.Z * oppZ, 3, C.COURT.HALF_LENGTH - 1) * oppZ
    )

    local autoShotType = shotType or "flat"
    if typeof(autoShotType) ~= "string" then autoShotType = "flat" end

    BallController.applyHit(root.Position, targetPos, autoShotType, timingQuality, playerIdx)
end)

-- ─── Client serve request ────────────────────────────────────────────────────
RE.ServeRequest.OnServerEvent:Connect(function(player, targetPos)
    if state ~= STATE.SERVING then return end

    local playerIdx = sides[player.UserId]
    if not playerIdx then return end
    if playerIdx ~= MatchManager.getServer() then return end

    local char = player.Character
    if not char then return end
    local root = char:FindFirstChild("HumanoidRootPart")
    if not root then return end

    local ball = BallController.getBall()
    if not ball then return end

    -- Serve timing quality
    local ballY = ball.Position.Y - root.Position.Y
    local optimalTossY = C.GAME.SERVE_TOSS_HEIGHT * 0.75
    local deviation = math.abs(ballY - optimalTossY)
    local timingQuality = math.clamp(1 - deviation / 5, 0, 1)

    local oppZ = playerIdx == 1 and -1 or 1
    if typeof(targetPos) ~= "Vector3" then
        targetPos = Vector3.new(
            math.random(-5, 5),
            0.5,
            oppZ * (C.COURT.SERVICE_DEPTH - 3)
        )
    end
    targetPos = Vector3.new(
        math.clamp(targetPos.X, -C.COURT.HALF_WIDTH / 4, C.COURT.HALF_WIDTH / 4),
        0.5,
        math.clamp(math.abs(targetPos.Z), 3, C.COURT.SERVICE_DEPTH - 0.5) * oppZ
    )

    BallController.applyHit(root.Position, targetPos, "serve", timingQuality, playerIdx)
    setState(STATE.RALLY)
end)

-- ─── Out-of-bounds heartbeat check ──────────────────────────────────────────
RunService.Heartbeat:Connect(function()
    if state ~= STATE.RALLY then return end

    local oob = BallController.checkBounds()
    if oob then
        local lastHitter = BallController.getLastBouncer()
        local winner = lastHitter == 1 and 2 or 1
        endPoint(winner, "out")
    end
end)

-- ─── Player join / leave ────────────────────────────────────────────────────
Players.PlayerAdded:Connect(function(player)
    player.CharacterAdded:Wait()
    task.wait(1)
    assignPlayers()
    teleportToSpawns()

    if #Players:GetPlayers() >= 2 and state == STATE.WAITING then
        task.wait(2)
        showMessage("SPIKE TENNIS", 2)
        task.wait(2)
        setState(STATE.RALLY)  -- skip to rally for solo testing with 1 player
        startPoint()
    elseif #Players:GetPlayers() == 1 and state == STATE.WAITING then
        showMessage("WAITING FOR OPPONENT...", 0)
    end
end)

Players.PlayerRemoving:Connect(function(player)
    sides[player.UserId] = nil
    for i, p in ipairs(players) do
        if p == player then
            players[i] = nil
        end
    end
    if state ~= STATE.WAITING and state ~= STATE.MATCH_OVER then
        setState(STATE.WAITING)
        showMessage("PLAYER LEFT", 2)
    end
end)

print("[SpikeTennis] GameManager ready.")
