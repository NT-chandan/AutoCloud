import createSystemLog from '@salesforce/apex/SystemLogger.createLog';
import { reduceErrors } from 'c/utils';

class SystemLoggerService {
    log(logLevel, error, relatedObjectId, componentInfo) {

        for (const err of reduceErrors(error)) {
            createSystemLog({
                logLevelString: logLevel,
                msg: err,
                relatedObjectId: null,
                componentInfo: componentInfo
            })
                .catch(sysLogError => {
                    console.log('**** error from apex action: ****');
                    console.log(sysLogError);
                });
        }
    }
}

export { SystemLoggerService }