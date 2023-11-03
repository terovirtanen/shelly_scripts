const Heater = require('../heating_element'); // Assuming the code is in a separate file called heater.js

describe('Heater', () => {
  let mockShelly;
  let mockTimer;

  beforeEach(() => {
    mockShelly = {
      call: jest.fn(),
      emitEvent: jest.fn(),
      addEventHandler: jest.fn(),
    };

    mockTimer = {
      set: jest.fn(),
    };

    global.Shelly = mockShelly;
    global.Timer = mockTimer;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('init', () => {
    it('should initialize solarPowerStatus to -2', () => {
      Heater.init();
      expect(Heater.solarPowerStatus).toBe(-2);
    });
  });

  describe('getEmTotalCallback', () => {
    it('should set emTotalAct and emTotalActRet when result is not null', () => {
      const result = {
        total_act: 100,
        total_act_ret: 50,
      };

      Heater.getEmTotalCallback(result);
      expect(Heater.emTotalAct).toBe(100);
      expect(Heater.emTotalActRet).toBe(50);
    });

    it('should set emTotalAct and emTotalActRet to null when result is null', () => {
      Heater.getEmTotalCallback(null);
      expect(Heater.emTotalAct).toBeNull();
      expect(Heater.emTotalActRet).toBeNull();
    });
  });

  describe('refresh', () => {
    it('should call callGetTemperature with the correct id', () => {
      Heater.refresh();
      expect(Shelly.call).toHaveBeenCalledWith(
        'Temperature.GetStatus',
        { id: CONFIG.anturi_id_ylakierto },
        expect.any(Function),
        null
      );
    });
  });

  describe('switchVastus', () => {
    it('should call Switch.Set with the correct parameters', () => {
      Heater.switchVastus(true);
      expect(Shelly.call).toHaveBeenCalledWith(
        'Switch.Set',
        { id: 0, on: true },
        expect.any(Function)
      );
    });
  });

});