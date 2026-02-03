"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Thermostat = void 0;
const js_quantities_1 = __importDefault(require("js-quantities"));
class Thermostat {
    constructor(platform, infinitive, name) {
        this.platform = platform;
        this.infinitive = infinitive;
        this.name = name;
        const { Name, CurrentHeatingCoolingState, TargetHeatingCoolingState, CurrentTemperature, TargetTemperature, TemperatureDisplayUnits, CurrentRelativeHumidity, CoolingThresholdTemperature, HeatingThresholdTemperature, } = this.platform.api.hap.Characteristic;
        this.log = this.platform.log;
        this.informationService = new this.platform.api.hap.Service.AccessoryInformation()
            .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'Carrier')
            .setCharacteristic(this.platform.api.hap.Characteristic.Model, 'Infinitive')
            .setCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, this.platform.config.url);
        this.service = new this.platform.api.hap.Service.Thermostat(this.name);
        this.service.setCharacteristic(Name, `${this.platform.config.name} Thermostat`);
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
    async getCurrentHeatingCoolingState() {
        const { CurrentHeatingCoolingState } = this.platform.api.hap.Characteristic;
        const { currentTemp, mode, heatSetpoint, coolSetpoint, } = await this.infinitive.fetchThermostatState();
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
                }
                else if (currentTemp > coolSetpoint) {
                    return CurrentHeatingCoolingState.COOL;
                }
                else {
                    return CurrentHeatingCoolingState.OFF;
                }
        }
    }
    async getTargetHeatingCoolingState() {
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
                throw new this.platform.api.hap.HapStatusError(-70402 /* SERVICE_COMMUNICATION_FAILURE */);
        }
    }
    async setTargetHeatingCoolingState(state) {
        const { TargetHeatingCoolingState, TargetTemperature, CurrentHeatingCoolingState, } = this.platform.api.hap.Characteristic;
        const oldState = await this.infinitive.fetchThermostatState();
        const baseState = {
        // cjh change 2/21/2022 5pm
        // fanMode: 'auto',
        // hold: true,
        };
        switch (state) {
            case TargetHeatingCoolingState.OFF:
                // cjh change 3/2/2022 1pm
                // this.infinitive.setThermostatState({ mode: 'off', ...baseState });
                break;
            case TargetHeatingCoolingState.HEAT:
                this.infinitive.setThermostatState({ mode: 'heat', ...baseState });
                this.service.updateCharacteristic(TargetTemperature, (0, js_quantities_1.default)(oldState.heatSetpoint, 'tempF').to('tempC').scalar);
                break;
            case TargetHeatingCoolingState.COOL:
                this.infinitive.setThermostatState({ mode: 'cool', ...baseState });
                this.service.updateCharacteristic(TargetTemperature, (0, js_quantities_1.default)(oldState.coolSetpoint, 'tempF').to('tempC').scalar);
                break;
            case TargetHeatingCoolingState.AUTO:
                this.infinitive.setThermostatState({ mode: 'auto', ...baseState });
                break;
            default:
                this.log.error(`Invalid HeatingCoolingState ${state}`);
                throw new this.platform.api.hap.HapStatusError(-70402 /* SERVICE_COMMUNICATION_FAILURE */);
        }
        this.service.updateCharacteristic(CurrentHeatingCoolingState, await this.getCurrentHeatingCoolingState());
    }
    async getCurrentTemperature() {
        const state = await this.infinitive.fetchThermostatState();
        const temperature = (0, js_quantities_1.default)(state.currentTemp, 'tempF');
        return temperature.to('tempC').scalar;
    }
    async getTargetTemperature() {
        const state = await this.infinitive.fetchThermostatState();
        const { mode, currentTemp, heatSetpoint, coolSetpoint } = state;
        switch (mode) {
            case 'off':
                return 0;
            case 'auto':
                return (0, js_quantities_1.default)(currentTemp < heatSetpoint ? heatSetpoint : coolSetpoint, 'tempF').to('tempC').scalar;
            case 'heat':
                return (0, js_quantities_1.default)(heatSetpoint, 'tempF').to('tempC').scalar;
            case 'electic':
                return (0, js_quantities_1.default)(heatSetpoint, 'tempF').to('tempC').scalar;
            case 'heatpump':
                return (0, js_quantities_1.default)(heatSetpoint, 'tempF').to('tempC').scalar;
            case 'cool':
                return (0, js_quantities_1.default)(coolSetpoint, 'tempF').to('tempC').scalar;
            default:
                this.log.error(`Invalid thermostat mode ${mode}`);
                throw new this.platform.api.hap.HapStatusError(-70402 /* SERVICE_COMMUNICATION_FAILURE */);
        }
    }
    async setTargetTemperature(temperature) {
        const { CurrentHeatingCoolingState, } = this.platform.api.hap.Characteristic;
        const state = await this.infinitive.fetchThermostatState();
        const { mode } = state;
        const tempC = (0, js_quantities_1.default)(temperature, 'tempC');
        const baseState = {
        // cjh change 2/21/2022 5pm
        // fanMode: 'auto',
        // hold: true,
        };
        switch (mode) {
            case 'heat':
                this.infinitive.setThermostatState({
                    heatSetpoint: Math.round(tempC.to('tempF').scalar),
                    ...baseState,
                });
                break;
            case 'cool':
                this.infinitive.setThermostatState({
                    coolSetpoint: Math.round(tempC.to('tempF').scalar),
                    ...baseState,
                });
                break;
            default:
                // 'auto' uses coolSetpoint and heatSetpoint sequentially
                this.infinitive.setThermostatState({
                    ...baseState,
                });
        }
        this.service.updateCharacteristic(CurrentHeatingCoolingState, await this.getCurrentHeatingCoolingState());
    }
    async getTemperatureDisplayUnits() {
        const { TemperatureDisplayUnits } = this.platform.api.hap.Characteristic;
        return TemperatureDisplayUnits.FAHRENHEIT;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async setTemperatureDisplayUnits(unit) {
        return;
    }
    async getCurrentRelativeHumidity() {
        const state = await this.infinitive.fetchThermostatState();
        return state.currentHumidity;
    }
    async getCoolingThresholdTemperature() {
        const state = await this.infinitive.fetchThermostatState();
        const tempC = (0, js_quantities_1.default)(state.coolSetpoint, 'tempF');
        return tempC.to('tempC').scalar;
    }
    async setCoolingThresholdTemperature(temperature) {
        const { CurrentHeatingCoolingState, } = this.platform.api.hap.Characteristic;
        const tempC = (0, js_quantities_1.default)(temperature, 'tempC');
        await this.infinitive.setThermostatState({
            coolSetpoint: Math.round(tempC.to('tempF').scalar),
        });
        this.service.updateCharacteristic(CurrentHeatingCoolingState, await this.getCurrentHeatingCoolingState());
    }
    async getHeatingThresholdTemperature() {
        const state = await this.infinitive.fetchThermostatState();
        const tempC = (0, js_quantities_1.default)(state.heatSetpoint, 'tempF');
        return tempC.to('tempC').scalar;
    }
    async setHeatingThresholdTemperature(temperature) {
        const { CurrentHeatingCoolingState, } = this.platform.api.hap.Characteristic;
        const tempC = (0, js_quantities_1.default)(temperature, 'tempC');
        await this.infinitive.setThermostatState({
            heatSetpoint: Math.round(tempC.to('tempF').scalar),
        });
        this.service.updateCharacteristic(CurrentHeatingCoolingState, await this.getCurrentHeatingCoolingState());
    }
}
exports.Thermostat = Thermostat;
//# sourceMappingURL=thermostat.cjh.js.map
