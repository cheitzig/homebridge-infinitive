import { Service, CharacteristicValue, Logger } from 'homebridge';

import { InfinitivePlatform } from './platform';
import { Infinitive, fahrenheitToCelsius, celsiusToFahrenheit } from './infinitive';

export class Thermostat {
  private readonly log: Logger;
  private informationService: Service;
  private service: Service;

  constructor(
    private readonly platform: InfinitivePlatform,
    private readonly infinitive: Infinitive,
    private readonly name: string,
  ) {
    const {
      Name,
      CurrentHeatingCoolingState,
      TargetHeatingCoolingState,
      CurrentTemperature,
      TargetTemperature,
      TemperatureDisplayUnits,
      CurrentRelativeHumidity,
      CoolingThresholdTemperature,
      HeatingThresholdTemperature,
    } = this.platform.api.hap.Characteristic;

    this.log = this.platform.log;

    this.informationService = new this.platform.api.hap.Service.AccessoryInformation()
      .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'Carrier')
      .setCharacteristic(this.platform.api.hap.Characteristic.Model, 'Infinitive')
      .setCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, this.platform.config.url);

    this.service = new this.platform.api.hap.Service.Thermostat(this.name);

    this.service.setCharacteristic(Name, `${this.platform.config.name}`);
    // this.service.setCharacteristic(Name, `${this.platform.config.name} Thermostat`);

    this.service.getCharacteristic(CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.service.getCharacteristic(TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState.bind(this))
      .onGet(this.getTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(TargetTemperature)
      .onSet(this.setTargetTemperature.bind(this))
      .onGet(this.getTargetTemperature.bind(this));

    this.service.getCharacteristic(TemperatureDisplayUnits)
      .onSet(this.setTemperatureDisplayUnits.bind(this))
      .onGet(this.getTemperatureDisplayUnits.bind(this));

    this.service.getCharacteristic(CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this));

    this.service.getCharacteristic(CoolingThresholdTemperature)
      .onSet(this.setCoolingThresholdTemperature.bind(this))
      .onGet(this.getCoolingThresholdTemperature.bind(this));

    this.service.getCharacteristic(HeatingThresholdTemperature)
      .onSet(this.setHeatingThresholdTemperature.bind(this))
      .onGet(this.getHeatingThresholdTemperature.bind(this));
  }

  getServices() {
    return [
      this.informationService,
      this.service,
    ];
  }

  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    const { CurrentHeatingCoolingState } = this.platform.api.hap.Characteristic;
    const {
      currentTemp,
      mode,
      heatSetpoint,
      coolSetpoint,
    } = await this.infinitive.fetchThermostatState();

    // TODO: a much easier way in Infinitive > 0.2 is to read the blower fan's
    // RPMs
    switch (mode) {
      case 'off':
        return CurrentHeatingCoolingState.OFF;
      case 'heat':
        return currentTemp < heatSetpoint ?
          CurrentHeatingCoolingState.HEAT :
          CurrentHeatingCoolingState.OFF;
      case 'electric':
        return currentTemp < heatSetpoint ?
          CurrentHeatingCoolingState.HEAT :
          CurrentHeatingCoolingState.OFF;
      case 'heatpump':
        return currentTemp < heatSetpoint ?
          CurrentHeatingCoolingState.HEAT :
          CurrentHeatingCoolingState.OFF;
      case 'cool':
        return currentTemp > coolSetpoint ?
          CurrentHeatingCoolingState.COOL :
          CurrentHeatingCoolingState.OFF;
      default:
        if (currentTemp < heatSetpoint) {
          return CurrentHeatingCoolingState.HEAT;
        } else if (currentTemp > coolSetpoint) {
          return CurrentHeatingCoolingState.COOL;
        } else {
          return CurrentHeatingCoolingState.OFF;
        }
    }
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    const { mode } = await this.infinitive.fetchThermostatState();
    const { TargetHeatingCoolingState } = this.platform.api.hap.Characteristic;

    switch (mode) {
      case 'off':
        return TargetHeatingCoolingState.OFF;
      case 'heat':
        return TargetHeatingCoolingState.HEAT;
      case 'electric':
        return TargetHeatingCoolingState.HEAT;
      case 'heatpump':
        return TargetHeatingCoolingState.HEAT;
      case 'cool':
        return TargetHeatingCoolingState.COOL;
      case 'auto':
        return TargetHeatingCoolingState.AUTO;
      default:
        this.log.error(`Invalid HeatingCoolingState ${mode}`);
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
    }
  }

  async setTargetHeatingCoolingState(state: CharacteristicValue) {
    const {
      TargetHeatingCoolingState,
      TargetTemperature,
      CurrentHeatingCoolingState,
    } = this.platform.api.hap.Characteristic;
    const oldState = await this.infinitive.fetchThermostatState();
    const baseState = {
      // cjh change 2/21/2022 5pm
      // The original author forced fanMode to 'auto' and hold to true here as the baseState
      // I don't want fan mode to be forced to auto or hold to be "on" in general like the original author did
      // I don't actually think I need a baseState at all, but leaving it here for possible future use
      // fanMode: 'auto',
      // hold: true,
    };

    switch (state) {
      case TargetHeatingCoolingState.OFF:
        // cjh change 3/2/2022 1pm (commented out turning it off)
        // this.infinitive.setThermostatState({ mode: 'off', ...baseState });
        // I don't ever want HomeKit to completely turn off the thermostat, as that risks freezing pipes in winter.
        // Instead, set it to auto with wide setpoint range
        this.infinitive.setThermostatState({
          mode: 'auto',
          heatSetpoint: 55,
          coolSetpoint: 85,
          ...baseState,
        });
        break;
      case TargetHeatingCoolingState.HEAT:
        await this.infinitive.setThermostatState({ mode: 'heat', ...baseState });
        this.service.updateCharacteristic(
          TargetTemperature,
          fahrenheitToCelsius(oldState.heatSetpoint),
        );
        break;
      case TargetHeatingCoolingState.COOL:
        await this.infinitive.setThermostatState({ mode: 'cool', ...baseState });
        this.service.updateCharacteristic(
          TargetTemperature,
          fahrenheitToCelsius(oldState.coolSetpoint),
        );
        break;
      case TargetHeatingCoolingState.AUTO:
        await this.infinitive.setThermostatState({ mode: 'auto', ...baseState });
        break;
      default:
        this.log.error(`Invalid HeatingCoolingState ${state}`);
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
    }

    this.service.updateCharacteristic(
      CurrentHeatingCoolingState,
      await this.getCurrentHeatingCoolingState(),
    );
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const state = await this.infinitive.fetchThermostatState();

    return fahrenheitToCelsius(state.currentTemp);
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    const state = await this.infinitive.fetchThermostatState();
    const { mode, currentTemp, heatSetpoint, coolSetpoint } = state;

    switch (mode) {
      case 'off':
        return 0;
      case 'auto':
        return fahrenheitToCelsius(
          currentTemp < heatSetpoint ? heatSetpoint : coolSetpoint,
        );
      case 'heat':
      case 'electric':
      case 'heatpump':
        return fahrenheitToCelsius(heatSetpoint);
      case 'cool':
        return fahrenheitToCelsius(coolSetpoint);
      default:
        this.log.error(`Invalid thermostat mode ${mode}`);
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
        );
    }
  }

  async setTargetTemperature(temperature: CharacteristicValue) {
    const {
      CurrentHeatingCoolingState,
    } = this.platform.api.hap.Characteristic;
    const state = await this.infinitive.fetchThermostatState();
    const { mode } = state;
    const baseState = {
      // cjh change 2/21/2022 5pm
      // The original author forced fanMode to 'auto' and hold to true here as the baseState
      // I don't want fan mode to be forced to auto or hold to be "on" in general like the original author did
      // I don't actually think I need a baseState at all, but leaving it here for possible future use
      // fanMode: 'auto',
      // hold: true,
    };

    switch (mode) {
      case 'heat':
        await this.infinitive.setThermostatState({
          heatSetpoint: Math.round(celsiusToFahrenheit(temperature as number)),
          ...baseState,
        });
        break;
      case 'cool':
        await this.infinitive.setThermostatState({
          coolSetpoint: Math.round(celsiusToFahrenheit(temperature as number)),
          ...baseState,
        });
        break;
      default:
        // 'auto' uses coolSetpoint and heatSetpoint sequentially
        await this.infinitive.setThermostatState({
          ...baseState,
        });
    }

    this.service.updateCharacteristic(
      CurrentHeatingCoolingState,
      await this.getCurrentHeatingCoolingState(),
    );
  }

  async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
    const { TemperatureDisplayUnits } = this.platform.api.hap.Characteristic;
    return TemperatureDisplayUnits.FAHRENHEIT;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setTemperatureDisplayUnits(unit: CharacteristicValue) {
    return;
  }

  async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
    const state = await this.infinitive.fetchThermostatState();

    return state.currentHumidity;
  }

  async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
    const state = await this.infinitive.fetchThermostatState();

    return fahrenheitToCelsius(state.coolSetpoint);
  }

  async setCoolingThresholdTemperature(temperature: CharacteristicValue) {
    const {
      CurrentHeatingCoolingState,
    } = this.platform.api.hap.Characteristic;

    await this.infinitive.setThermostatState({
      coolSetpoint: Math.round(celsiusToFahrenheit(temperature as number)),
    });

    this.service.updateCharacteristic(
      CurrentHeatingCoolingState,
      await this.getCurrentHeatingCoolingState(),
    );
  }

  async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
    const state = await this.infinitive.fetchThermostatState();

    return fahrenheitToCelsius(state.heatSetpoint);
  }

  async setHeatingThresholdTemperature(temperature: CharacteristicValue) {
    const {
      CurrentHeatingCoolingState,
    } = this.platform.api.hap.Characteristic;

    await this.infinitive.setThermostatState({
      heatSetpoint: Math.round(celsiusToFahrenheit(temperature as number)),
    });

    this.service.updateCharacteristic(
      CurrentHeatingCoolingState,
      await this.getCurrentHeatingCoolingState(),
    );
  }
}
