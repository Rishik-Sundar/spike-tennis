-- Spike Tennis — CourtBuilder
-- Constructs the entire visual court, net, surroundings, and lighting.
local Constants = require(game.ReplicatedStorage.Modules.Constants)
local C = Constants

local courtFolder = Instance.new("Folder")
courtFolder.Name = "SpikeTennisCourt"
courtFolder.Parent = workspace

local function makePart(name, size, position, color, material, anchored)
    local p = Instance.new("Part")
    p.Name = name
    p.Size = size
    p.Position = position
    p.Color = color
    p.Material = material or Enum.Material.SmoothPlastic
    p.Anchored = anchored ~= false
    p.CanCollide = true
    p.CastShadow = false
    p.TopSurface = Enum.SurfaceType.Smooth
    p.BottomSurface = Enum.SurfaceType.Smooth
    p.Parent = courtFolder
    return p
end

local function makeWedge(name, size, cf, color)
    local w = Instance.new("WedgePart")
    w.Name = name
    w.Size = size
    w.CFrame = cf
    w.Color = color
    w.Material = Enum.Material.SmoothPlastic
    w.Anchored = true
    w.CanCollide = false
    w.CastShadow = false
    w.TopSurface = Enum.SurfaceType.Smooth
    w.Parent = courtFolder
    return w
end

-- ─── Ground surround ────────────────────────────────────────────────────────
makePart("Surround", Vector3.new(120, 1, 140),
    Vector3.new(0, -0.5, 0), C.COLORS.COURT_SURROUND, Enum.Material.SmoothPlastic)

-- ─── Main court surface ──────────────────────────────────────────────────────
local court = makePart("CourtSurface",
    Vector3.new(C.COURT.WIDTH, 0.5, C.COURT.LENGTH),
    Vector3.new(0, 0.25, 0),
    C.COLORS.COURT_MAIN, Enum.Material.SmoothPlastic)
court.Name = "CourtSurface"

-- ─── Court lines ─────────────────────────────────────────────────────────────
local LT = 0.3  -- line thickness (Y)
local LH = 0.4  -- line height above court
local LINE_COLOR = C.COLORS.LINE

local function line(name, sx, sz, px, pz)
    return makePart(name, Vector3.new(sx, LT, sz),
        Vector3.new(px, 0.5 + LH/2, pz), LINE_COLOR, Enum.Material.Neon)
end

local HW = C.COURT.HALF_WIDTH
local HL = C.COURT.HALF_LENGTH
local SD = C.COURT.SERVICE_DEPTH

-- Baselines
line("BaselineP1", C.COURT.WIDTH, 0.25, 0,  HL)
line("BaselineP2", C.COURT.WIDTH, 0.25, 0, -HL)

-- Singles sidelines
line("SidelineP1_L", 0.25, C.COURT.LENGTH, -HW/2, 0)
line("SidelineP1_R", 0.25, C.COURT.LENGTH,  HW/2, 0)

-- Doubles sidelines
line("DoublesL", 0.25, C.COURT.LENGTH, -HW, 0)
line("DoublesR", 0.25, C.COURT.LENGTH,  HW, 0)

-- Service lines
line("ServiceLineP1", HW, 0.25, 0,  SD)
line("ServiceLineP2", HW, 0.25, 0, -SD)

-- Center service line (full length between service lines)
line("CenterServiceLine", 0.25, SD * 2, 0, 0)

-- Center mark at each baseline
line("CenterMarkP1", 0.25, 1.5, 0,  HL - 0.75)
line("CenterMarkP2", 0.25, 1.5, 0, -HL + 0.75)

-- ─── Net ─────────────────────────────────────────────────────────────────────
local NET_SEGMENTS = 20
local netWidth = C.COURT.WIDTH + 2  -- posts extend beyond sidelines
local segW = netWidth / NET_SEGMENTS

for i = 0, NET_SEGMENTS - 1 do
    local xPos = -netWidth / 2 + segW * i + segW / 2
    -- Vary height slightly for center droop (0.15 stud droop)
    local droop = 0.15 * math.sin(math.pi * (i / (NET_SEGMENTS - 1)))
    local netH = C.COURT.NET_HEIGHT - droop
    local seg = makePart("NetSeg" .. i,
        Vector3.new(segW + 0.05, netH, 0.12),
        Vector3.new(xPos, netH / 2, 0),
        C.COLORS.NET_BODY, Enum.Material.Neon)
    seg.Transparency = 0.45
    seg.CanCollide = true
end

-- Net tape (white top strip)
local tape = makePart("NetTape",
    Vector3.new(netWidth, 0.25, 0.18),
    Vector3.new(0, C.COURT.NET_HEIGHT - 0.1, 0),
    C.COLORS.NET_TAPE, Enum.Material.SmoothPlastic)
tape.CanCollide = true

-- Net posts
for _, side in ipairs({-1, 1}) do
    makePart("NetPost" .. side,
        Vector3.new(0.5, C.COURT.NET_HEIGHT + 0.5, 0.5),
        Vector3.new(side * (netWidth / 2), (C.COURT.NET_HEIGHT + 0.5) / 2, 0),
        C.COLORS.NET_POST, Enum.Material.Metal)
end

-- ─── Spawn pads ──────────────────────────────────────────────────────────────
for _, side in ipairs({1, -1}) do
    local pad = makePart("SpawnPad" .. side,
        Vector3.new(4, 0.1, 4),
        Vector3.new(0, 0.55, side * (HL - 5)),
        Color3.fromRGB(255, 220, 50), Enum.Material.Neon)
    pad.Transparency = 0.6
    pad.CanCollide = false

    -- glowing ring effect
    local ring = Instance.new("SelectionBox")
    ring.Adornee = pad
    ring.Color3 = Color3.fromRGB(255, 220, 50)
    ring.LineThickness = 0.08
    ring.Parent = pad
end

-- ─── Stadium walls / bleachers (simple boxes) ────────────────────────────────
local WALL_Y = 8
for _, data in ipairs({
    { Vector3.new(130, WALL_Y, 3), Vector3.new(0, WALL_Y / 2, 75) },
    { Vector3.new(130, WALL_Y, 3), Vector3.new(0, WALL_Y / 2, -75) },
    { Vector3.new(3, WALL_Y, 150), Vector3.new(65, WALL_Y / 2, 0) },
    { Vector3.new(3, WALL_Y, 150), Vector3.new(-65, WALL_Y / 2, 0) },
}) do
    local w = makePart("Wall", data[1], data[2],
        Color3.fromRGB(200, 200, 210), Enum.Material.SmoothPlastic)
    w.CanCollide = false
    w.Transparency = 0.4
end

-- Stadium floor extension
makePart("StadiumFloor", Vector3.new(140, 1, 160),
    Vector3.new(0, -1, 0), Color3.fromRGB(60, 60, 70), Enum.Material.Concrete)

-- ─── Lighting & Post-Processing ──────────────────────────────────────────────
local Lighting = game:GetService("Lighting")
Lighting.Ambient = Color3.fromRGB(100, 120, 160)
Lighting.Brightness = 2.5
Lighting.ClockTime = 14.5
Lighting.FogEnd = 1000
Lighting.GlobalShadows = true
Lighting.OutdoorAmbient = Color3.fromRGB(120, 150, 180)
Lighting.ShadowSoftness = 0.25

-- Clear existing effects
for _, e in ipairs(Lighting:GetChildren()) do
    if e:IsA("PostEffect") or e:IsA("Sky") or e:IsA("Atmosphere") then
        e:Destroy()
    end
end

-- Bloom
local bloom = Instance.new("BloomEffect")
bloom.Intensity = 0.55
bloom.Size = 20
bloom.Threshold = 0.85
bloom.Parent = Lighting

-- SunRays
local sunRays = Instance.new("SunRaysEffect")
sunRays.Intensity = 0.08
sunRays.Spread = 0.6
sunRays.Parent = Lighting

-- Color Correction — punchy, vibrant
local cc = Instance.new("ColorCorrectionEffect")
cc.Brightness = 0.04
cc.Contrast = 0.12
cc.Saturation = 0.25
cc.TintColor = Color3.fromRGB(245, 245, 255)
cc.Parent = Lighting

-- Atmosphere
local atm = Instance.new("Atmosphere")
atm.Density = 0.28
atm.Offset = 0.4
atm.Color = Color3.fromRGB(200, 220, 255)
atm.Decay = Color3.fromRGB(100, 130, 180)
atm.Glare = 0.3
atm.Haze = 2
atm.Parent = Lighting

-- Sky
local sky = Instance.new("Sky")
sky.SkyboxBk = "rbxassetid://1012511951"
sky.SkyboxDn = "rbxassetid://1012511956"
sky.SkyboxFt = "rbxassetid://1012511959"
sky.SkyboxLf = "rbxassetid://1012511962"
sky.SkyboxRt = "rbxassetid://1012511965"
sky.SkyboxUp = "rbxassetid://1012511969"
sky.StarCount = 3000
sky.SunAngularSize = 11
sky.MoonAngularSize = 11
sky.Parent = Lighting

-- ─── Court glow panels (decorative neon trim) ────────────────────────────────
for _, z in ipairs({ HL + 1, -HL - 1 }) do
    local glow = makePart("CourtGlow",
        Vector3.new(C.COURT.WIDTH + 4, 0.15, 0.15),
        Vector3.new(0, 0.6, z),
        Color3.fromRGB(0, 180, 255), Enum.Material.Neon)
    glow.CanCollide = false
end
for _, x in ipairs({ HW + 0.5, -HW - 0.5 }) do
    local glow = makePart("CourtGlowSide",
        Vector3.new(0.15, 0.15, C.COURT.LENGTH + 4),
        Vector3.new(x, 0.6, 0),
        Color3.fromRGB(0, 180, 255), Enum.Material.Neon)
    glow.CanCollide = false
end

print("[SpikeTennis] Court built.")
