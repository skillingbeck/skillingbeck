// https://medium.com/hackernoon/why-capacity-planning-needs-queueing-theory-without-the-hard-math-342a851e215c
    // https://en.wikipedia.org/wiki/M/M/c_queue
    var servers = 1
    var arrivalRate = 0.45
    var serviceRate = 0.5

    function modelQueue(servers, arrivalRate, serviceRate) {
        var utilisation = arrivalRate/(servers*serviceRate)

        if(utilisation >= 1) {
            console.log("Unbounded queue!")
            return {serverUtilisation: utilisation}
        }

        var C = cFormula(servers, arrivalRate, serviceRate)

        var averageCustomers = utilisation/(1 - utilisation)*C + servers*utilisation
        var responseTime = C/(servers*serviceRate - arrivalRate) + 1/serviceRate
        
        return {
            serverUtilisation: utilisation,
            probabilityOfQueuing: C,
            averageCustomersInSystem: averageCustomers,
            responseTime: responseTime
        }
    }
    
    function cFormula(c, l, m) {
        var p = l / (c*m) //utilisation
        var sum = 0
        for (k = 0; k <= c-1; k++) {
            sum += Math.pow(c*p, k)/factorial(k)   
        }
        var multiplier = factorial(c)/Math.pow(c*p, c)
        var denominator = 1 + (1-p)*multiplier*sum
        return 1/denominator
    }

    function factorial(num)
    {
        var rval=1;
        for (var i = 2; i <= num; i++)
            rval = rval * i;
        return rval;
    }

    // https://towardsdatascience.com/the-poisson-process-everything-you-need-to-know-322aa0ab9e9a
    // M/M/c queues have arrivals based on the Poisson distribution
    // which means inter-arrival times (time between arrivals) follow an exponential distribution
    function generateInterArrival(rate) {
        var u = Math.random(); // uniform[0,1)
        return - Math.log(1.0-u)/rate
    }

    function scheduleNextArrival(rate, action, max) {
        var arrivalTime = generateInterArrival(rate)
        setTimeout(() => {
            action(arrivalTime)
            if(max > 1) {
                scheduleNextArrival(rate, action, max - 1)
            }
        }, arrivalTime*1000)
    }

    function workerPool(workers, rate, data, notify) {
        var pool = function() {}
        pool.data = data
        pool.rate = rate
        pool.workers = []
        for (var i = 0; i < workers; i++) {
            pool.workers.push({id: i, state: "idle"})
        }

        pool.notify = function() {
            var idleWorkers = pool.workers.filter(x => x.state == "idle")
            if(idleWorkers.length > 0) {
                pool.doWork(idleWorkers[0])

            }
            return pool
        }

        pool.doWork = function(worker) {
            var tasks = pool.data.filter(x => x.state == "queued")
            if (tasks.length == 0) { // no work left to do
                worker.state = "idle"
                return;
            }
            worker.state = "busy"
            var task = tasks[0]
            task.state = "in-progress"
            notify()
            scheduleNextArrival(pool.rate, () => {
                task.state = "done"
                notify()
                pool.doWork(worker)
            }, 1)

            return pool
        }

        return pool
    }

    function queueModel() {
        var model = function() {}
        model.data = []

        model.bind = function(base, scale = 10) {
            model.base = d3.select(base)
            model.graph = model.base.append("svg")
                .attr("width", "200px")
                .attr("height", "200px")
                //.attr("viewBox", `0 -20 ${width} 33`);
            //model.annotation = model.base.append("p")
            model.max = scale*scale
            model.scale = scale
            model.update()
            return model
        }

        model.update = function() {
            model.graph.selectAll("circle")
                .data(model.data, d => d.id)
                .join("circle")
                    .attr("class", d => d.state)
                    .attr("cx", (d,i) => (i % 10)*10+5 + "%")
                    .attr("cy", (d,i) => Math.floor(i / 10)*10+5 + "%")
                    .attr("r", "4.5%")
                    //.text(d => `${d.id}`)
            
            if(model.data.length == model.max && model.data.every(x => x.state == "done")) {
                model.start(model.rate, model.max)
            }

            return model

            
        }

        model.workers = function(workers, rate) {
            model.workerPool = workerPool(workers, rate, model.data, () => model.update())
            return model
        }

        model.start = function(rate) {
            model.data.length = 0
            model.rate = rate
            //model.annotation.text(`New tasks arrive ${rate} times per day on average. There are ${model.workerPool.workers.length} workers able to complete ${model.workerPool.rate} tasks per day on average.`)
            scheduleNextArrival(rate, () => {
                model.data.push({id: model.data.length, state: "queued"})
                model.update()
                model.workerPool.notify()
            }, model.max)
            return model
        }

        return model
    }

    var charts = {}

    
    console.log(modelQueue(servers,arrivalRate,serviceRate))