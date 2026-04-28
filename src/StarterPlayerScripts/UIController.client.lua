-- Spike Tennis — UIController (client)
-- Renders the scoreboard, timing ring, and big game messages.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local Remotes
do
    local rf = ReplicatedStorage:WaitForChild("Remotes", 20)
    if not rf then return end
    Remotes = {
        ScoreUpdate = rf:WaitForChild("ScoreUpdate"),
        ShowMessage = rf:WaitForChild("ShowMessage"),
        BallHit     = rf:WaitForChild("BallHit"),
        GameState   = rf:WaitForChild("GameState"),
        PlayerAssign = rf:WaitForChild("PlayerAssign"),
    }
end

local myIndex = 0

Remotes.PlayerAssign.OnClientEvent:Connect(function(idx)
    myIndex = idx
end)

-- ─── ScreenGui ───────────────────────────────────────────────────────────────
local gui = Instance.new("ScreenGui")
gui.Name = "SpikeTennisHUD"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = playerGui

-- ─── Helpers ─────────────────────────────────────────────────────────────────
local function makeFrame(name, size, pos, anchor, bg, parent)
    local f = Instance.new("Frame")
    f.Name = name
    f.Size = size
    f.Position = pos
    f.AnchorPoint = anchor or Vector2.new(0.5, 0.5)
    f.BackgroundColor3 = bg or Color3.fromRGB(0, 0, 0)
    f.BorderSizePixel = 0
    f.Parent = parent or gui
    return f
end

local function makeLabel(name, text, size, pos, anchor, parent, fontSize)
    local l = Instance.new("TextLabel")
    l.Name = name
    l.Text = text
    l.Size = size
    l.Position = pos
    l.AnchorPoint = anchor or Vector2.new(0.5, 0.5)
    l.BackgroundTransparency = 1
    l.Font = Enum.Font.GothamBold
    l.TextSize = fontSize or 20
    l.TextColor3 = Color3.fromRGB(255, 255, 255)
    l.TextStrokeTransparency = 0.5
    l.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
    l.Parent = parent or gui
    return l
end

-- ─── Scoreboard (top center) ─────────────────────────────────────────────────
local scoreBg = makeFrame("ScoreBg",
    UDim2.new(0, 380, 0, 100),
    UDim2.new(0.5, 0, 0, 12),
    Vector2.new(0.5, 0))
scoreBg.BackgroundTransparency = 0.25
scoreBg.BackgroundColor3 = Color3.fromRGB(10, 10, 20)
local uiCorner = Instance.new("UICorner")
uiCorner.CornerRadius = UDim.new(0, 10)
uiCorner.Parent = scoreBg

-- Player labels
local p1Label = makeLabel("P1Label", "P1", UDim2.new(0.4, 0, 0.45, 0),
    UDim2.new(0.25, 0, 0.5, 0), Vector2.new(0.5, 0.5), scoreBg, 18)
p1Label.TextColor3 = Color3.fromRGB(100, 210, 255)

local p2Label = makeLabel("P2Label", "P2", UDim2.new(0.4, 0, 0.45, 0),
    UDim2.new(0.75, 0, 0.5, 0), Vector2.new(0.5, 0.5), scoreBg, 18)
p2Label.TextColor3 = Color3.fromRGB(255, 130, 80)

-- Score display
local scoreLabel = makeLabel("ScoreLabel", "0 - 0",
    UDim2.new(1, 0, 0.55, 0), UDim2.new(0.5, 0, 0.52, 0),
    Vector2.new(0.5, 0.5), scoreBg, 28)
scoreLabel.TextColor3 = Color3.fromRGB(255, 255, 255)

-- Games / Sets row
local gameLabel = makeLabel("GameLabel", "Games: 0 - 0  |  Sets: 0 - 0",
    UDim2.new(1, -10, 0.35, 0), UDim2.new(0.5, 0, 0.08, 0),
    Vector2.new(0.5, 0), scoreBg, 15)
gameLabel.TextColor3 = Color3.fromRGB(180, 220, 255)

-- Serve indicator dot
local serveDot = makeLabel("ServeDot", "● SERVE",
    UDim2.new(0, 90, 0, 22), UDim2.new(0.5, 0, 1, -4),
    Vector2.new(0.5, 1), scoreBg, 13)
serveDot.TextColor3 = Color3.fromRGB(255, 220, 50)
serveDot.Visible = false

-- ─── Score update handler ────────────────────────────────────────────────────
Remotes.ScoreUpdate.OnClientEvent:Connect(function(scoreTable, result)
    local pts = scoreTable.points and scoreTable.points[1] or "0 - 0"
    scoreLabel.Text = pts
    gameLabel.Text = string.format("Games: %d - %d  |  Sets: %d - %d",
        scoreTable.games[1], scoreTable.games[2],
        scoreTable.sets[1],  scoreTable.sets[2])

    -- Highlight server
    serveDot.Text = "● P" .. scoreTable.server .. " SERVES"
    serveDot.Visible = true

    -- Flash score on point
    if result and result.type == "point" then
        local tw = TweenService:Create(scoreLabel,
            TweenInfo.new(0.12, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
            { TextSize = 38 })
        tw:Play()
        tw.Completed:Connect(function()
            TweenService:Create(scoreLabel,
                TweenInfo.new(0.2), { TextSize = 28 }):Play()
        end)
    end
end)

-- ─── Big message display ──────────────────────────────────────────────────────
local msgBg = makeFrame("MsgBg",
    UDim2.new(0, 500, 0, 70),
    UDim2.new(0.5, 0, 0.38, 0),
    Vector2.new(0.5, 0.5))
msgBg.BackgroundColor3 = Color3.fromRGB(5, 5, 15)
msgBg.BackgroundTransparency = 0.15
msgBg.Visible = false
local msgCorner = Instance.new("UICorner")
msgCorner.CornerRadius = UDim.new(0, 12)
msgCorner.Parent = msgBg

-- Neon border
local msgBorder = Instance.new("UIStroke")
msgBorder.Color = Color3.fromRGB(0, 180, 255)
msgBorder.Thickness = 2
msgBorder.Parent = msgBg

local msgText = makeLabel("MsgText", "", UDim2.new(1, 0, 1, 0),
    UDim2.new(0.5, 0, 0.5, 0), Vector2.new(0.5, 0.5), msgBg, 30)
msgText.TextColor3 = Color3.fromRGB(255, 255, 255)

local msgTask

local function showMsg(text, duration)
    if msgTask then task.cancel(msgTask) end

    msgText.Text = text
    msgBg.Visible = true
    msgBg.BackgroundTransparency = 0.15
    msgText.TextTransparency = 0
    msgText.TextSize = 22
    TweenService:Create(msgText,
        TweenInfo.new(0.18, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
        { TextSize = 30 }):Play()

    msgTask = task.delay(duration or 2.5, function()
        TweenService:Create(msgBg,
            TweenInfo.new(0.3), { BackgroundTransparency = 1 }):Play()
        TweenService:Create(msgText,
            TweenInfo.new(0.3), { TextTransparency = 1 }):Play()
        task.wait(0.35)
        msgBg.Visible = false
        msgText.TextTransparency = 0
    end)
end

Remotes.ShowMessage.OnClientEvent:Connect(function(text, duration)
    showMsg(text, duration)
end)

-- ─── Hit timing ring ─────────────────────────────────────────────────────────
-- Shows a circle ring indicator near the ball when in range
local timingRing = makeFrame("TimingRing",
    UDim2.new(0, 64, 0, 64), UDim2.new(0.5, 0, 0.5, 0), Vector2.new(0.5, 0.5))
timingRing.BackgroundTransparency = 1
timingRing.Visible = false

local ringCircle = Instance.new("UICorner")
ringCircle.CornerRadius = UDim.new(0.5, 0)
ringCircle.Parent = timingRing

local ringStroke = Instance.new("UIStroke")
ringStroke.Color = Color3.fromRGB(255, 220, 50)
ringStroke.Thickness = 3
ringStroke.Parent = timingRing

-- Inner fill that shrinks
local ringFill = makeFrame("Fill",
    UDim2.new(1, -8, 1, -8),
    UDim2.new(0.5, 0, 0.5, 0), Vector2.new(0.5, 0.5),
    Color3.fromRGB(255, 220, 50), timingRing)
ringFill.BackgroundTransparency = 0.6
local fillCorner = Instance.new("UICorner")
fillCorner.CornerRadius = UDim.new(0.5, 0)
fillCorner.Parent = ringFill

-- Shot type label inside ring
local shotLabel = makeLabel("ShotLabel", "FLAT",
    UDim2.new(1, 0, 1, 0), UDim2.new(0.5, 0, 0.5, 0),
    Vector2.new(0.5, 0.5), timingRing, 11)
shotLabel.TextColor3 = Color3.fromRGB(255, 220, 50)

local SHOT_COLORS = {
    flat    = Color3.fromRGB(255, 220, 50),
    topspin = Color3.fromRGB(80, 255, 120),
    slice   = Color3.fromRGB(80, 190, 255),
    lob     = Color3.fromRGB(200, 100, 255),
    smash   = Color3.fromRGB(255, 80, 80),
    serve   = Color3.fromRGB(255, 160, 50),
}

local lastTimingQuality = 0

RunService.RenderStepped:Connect(function()
    local char = player.Character
    local ball  = workspace:FindFirstChild("SpikeBall")
    if not char or not ball then
        timingRing.Visible = false
        return
    end

    local root = char:FindFirstChild("HumanoidRootPart")
    if not root then
        timingRing.Visible = false
        return
    end

    local dist = (root.Position - ball.Position).Magnitude
    local inRange = dist <= 9

    if inRange then
        timingRing.Visible = true

        -- Project ball to screen position
        local screenPos, onScreen = workspace.CurrentCamera:WorldToScreenPoint(ball.Position)
        if onScreen then
            timingRing.Position = UDim2.new(0, screenPos.X - 32, 0, screenPos.Y - 32)
        end

        -- Timing quality
        local ballY = ball.Position.Y - root.Position.Y
        local optY  = 1.2
        local dev   = math.abs(ballY - optY)
        local q     = math.clamp(1 - dev / 3, 0, 1)

        -- Scale ring: perfect = bright + big, bad = dim + small
        local scale = 0.7 + q * 0.5
        timingRing.Size = UDim2.new(0, 64 * scale, 0, 64 * scale)

        -- Color by timing
        local col
        if q > 0.85 then
            col = Color3.fromRGB(100, 255, 100)
        elseif q > 0.5 then
            col = Color3.fromRGB(255, 220, 50)
        else
            col = Color3.fromRGB(255, 80, 80)
        end
        ringStroke.Color = col
        ringFill.BackgroundColor3 = col

        -- Pulse fill on beat
        local t = tick() * 4
        local pulse = 0.55 + math.sin(t) * 0.2
        ringFill.BackgroundTransparency = 1 - (q * pulse)

        -- Shot type label
        -- Read current shot from PlayerController (via attribute set on character)
        local currentShot = char:GetAttribute("ShotType") or "flat"
        shotLabel.Text = string.upper(currentShot)
        ringStroke.Color = SHOT_COLORS[currentShot] or col
    else
        timingRing.Visible = false
    end
end)

-- ─── Hit feedback flash ───────────────────────────────────────────────────────
Remotes.BallHit.OnClientEvent:Connect(function(hitterIdx, shot, timing)
    if timing > 0.85 then
        showMsg("PERFECT!", 0.7)
    elseif timing > 0.5 then
        -- no message for good hit, just timing ring feedback
    end
end)

-- ─── Shot type attribute sync from PlayerController ──────────────────────────
-- PlayerController sets character attribute, we just read it in RenderStepped above

-- ─── Controls hint (bottom left) ─────────────────────────────────────────────
local hintBg = makeFrame("HintBg",
    UDim2.new(0, 220, 0, 100),
    UDim2.new(0, 14, 1, -114),
    Vector2.new(0, 0))
hintBg.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
hintBg.BackgroundTransparency = 0.45
local hintCorner = Instance.new("UICorner")
hintCorner.CornerRadius = UDim.new(0, 8)
hintCorner.Parent = hintBg

local hints = {
    "  CLICK / SPACE — Hit",
    "  Q — Topspin   E — Slice",
    "  R — Lob       F — Smash",
    "  SHIFT — Sprint",
}
for i, hint in ipairs(hints) do
    local lbl = makeLabel("Hint"..i, hint,
        UDim2.new(1, -4, 0, 22),
        UDim2.new(0, 2, 0, (i-1)*24 + 4),
        Vector2.new(0, 0), hintBg, 13)
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.TextColor3 = Color3.fromRGB(200, 200, 200)
end

print("[UIController] HUD ready.")
